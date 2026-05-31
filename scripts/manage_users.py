#!/usr/bin/env python3
"""
DeFi Platform — CHEAT SCRIPT
Полное управление БД. Только для разработки!
"""
import sys
import re
import json
import subprocess

PROJECT_DIR = "/home/ultor/projects/defi-platform"

# ── Цвета ─────────────────────────────────────────────────────
R = "\033[0m"; B = "\033[1m"; CYAN = "\033[96m"; GREEN = "\033[92m"
YELLOW = "\033[93m"; RED = "\033[91m"; GRAY = "\033[90m"; BLUE = "\033[94m"
MAGENTA = "\033[95m"


def _ansi_len(s: str) -> int:
    """Визуальная длина строк без ANSI-кодов."""
    return len(re.sub(r'\033\[[0-9;]*m', '', s))


def _pad(s: str, width: int) -> str:
    """Паддинг с учётом ANSI-кодов."""
    vis = _ansi_len(s)
    return s + ' ' * max(0, width - vis)


def _shell_quote(s: str) -> str:
    """Безопасное экранирование для inline SQL (одинарные кавычки)."""
    return s.replace("'", "''")


# ── Выполнить SELECT запрос ───────────────────────────────────
def psql(query: str, params: tuple = None) -> list:
    """
    Выполняет SQL-запрос через docker compose exec ... psql.
    Для SELECT-запросов возвращает list of list of str.
    Для DML используйте psql_exec().

    ВАЖНО: этот метод всё ещё подставляет строки в SQL-текст,
    но через _shell_quote() для базовой защиты.
    Для максимальной безопасности используйте psycopg2.
    """
    # Формируем SQL с экранированными параметрами
    if params:
        escaped = tuple(_shell_quote(str(p)) for p in params)
        query = query % escaped

    cmd = [
        "docker", "compose", "exec", "-T", "db",
        "psql", "-U", "defi", "-d", "defidb",
        "-t", "-A", "-F", "\t", "-c", query
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    if r.returncode != 0:
        print(f"{RED}DB Error: {r.stderr.strip()}{R}")
        return []

    stdout = r.stdout.strip()
    if not stdout:
        return []

    lines = [l for l in stdout.split("\n") if l]
    return [l.split("\t") for l in lines]


# ── Выполнить DML запрос ─────────────────────────────────────
def psql_exec(query: str, silent: bool = False, params: tuple = None) -> bool:
    """
    Выполняет DML/DDL запрос (INSERT, UPDATE, DELETE, ...).
    Возвращает True при успехе.
    """
    if params:
        escaped = tuple(_shell_quote(str(p)) for p in params)
        query = query % escaped

    cmd = [
        "docker", "compose", "exec", "-T", "db",
        "psql", "-U", "defi", "-d", "defidb",
        "-c", query
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    if r.returncode != 0:
        print(f"{RED}Error: {r.stderr.strip()}{R}")
        return False

    if not silent:
        out = r.stdout.strip()
        # Проверяем наличие DML-ключевых слов
        out_upper = out.upper()
        if any(x in out_upper for x in ("UPDATE", "DELETE", "INSERT")):
            print(f"{GREEN}✅ Done{R}")
        else:
            print(f"{GRAY}{out}{R}")
    return True


def bcrypt_hash(password: str) -> str:
    """Генерирует bcrypt-хеш пароля через бэкенд-контейнер."""
    safe_pw = password.replace("'", "\\'").replace("\n", "")
    cmd = [
        "docker", "compose", "exec", "-T", "backend", "python3", "-c",
        (
            "from passlib.context import CryptContext; "
            "ctx = CryptContext(schemes=['bcrypt']); "
            "print(ctx.hash(" + repr(safe_pw) + "))"
        )
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR, timeout=30)
    if r.returncode != 0:
        print(f"{RED}Bcrypt error: {r.stderr.strip()}{R}")
        return ""
    return r.stdout.strip()


def eth_wallet() -> tuple:
    """Генерирует новый ETH-кошелёк через бэкенд-сервис."""
    cmd = [
        "docker", "compose", "exec", "-T", "backend", "python3", "-c",
        (
            "from app.services.wallet_service import generate_wallet; "
            "import json; "
            "print(json.dumps(generate_wallet()))"
        )
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR, timeout=30)
    if r.returncode != 0:
        print(f"{RED}Wallet gen error: {r.stderr.strip()}{R}")
        return ("", "")
    try:
        data = json.loads(r.stdout.strip())
        return data["address"], data["encrypted_private_key"]
    except (json.JSONDecodeError, KeyError) as e:
        print(f"{RED}Wallet parse error: {e}{R}")
        return ("", "")


# ── Форматтеры ролей / KYC ───────────────────────────────────
def cr(role: str) -> str:
    return {
        "ADMIN":      f"{YELLOW}{B}ADMIN{R}",
        "USER":       f"{GREEN}USER{R}",
        "UNVERIFIED": f"{GRAY}UNVERIFIED{R}",
    }.get(role, role)


def ck(kyc: str) -> str:
    return {
        "APPROVED": f"{GREEN}APPROVED{R}",
        "PENDING":  f"{YELLOW}PENDING{R}",
        "REJECTED": f"{RED}REJECTED{R}",
        None:      GRAY + "—" + R,
        "":        GRAY + "—" + R,
    }.get(kyc or "", f"{GRAY}—{R}")


def hdr(text: str):
    print(f"\n{CYAN}{B}{'═' * 55}{R}")
    print(f"{CYAN}{B}  {text}{R}")
    print(f"{CYAN}{B}{'═' * 55}{R}")


def menu(opts: dict):
    print()
    for k, v in opts.items():
        print(f"  {BLUE}{B}[{k}]{R} {v}")
    print()


def inp(prompt: str, default: str = "") -> str:
    val = input(f"  {B}{prompt}{R} ").strip()
    return val if val else default


def confirm(msg: str) -> bool:
    return inp(f"{RED}{msg} (yes/no):{R}").lower() in ("yes", "y")


# ── Список пользователей ──────────────────────────────────────
def list_users(where: str = "1=1"):
    """
    Выводит список пользователей с основным кошельком и KYC-статусом.
    """
    rows = psql(f"""
        SELECT
            u.id,
            u.uid,
            u.username,
            u.email,
            u.role,
            (SELECT k.status FROM kyc_applications k
             WHERE k.user_id = u.id ORDER BY k.submitted_at DESC LIMIT 1) AS kyc_status,
            u.is_active,
            u.email_verified,
            COALESCE(
                (SELECT w.address FROM wallets w
                 WHERE w.user_id = u.id AND w.is_primary = true LIMIT 1),
                (SELECT w.address FROM wallets w
                 WHERE w.user_id = u.id LIMIT 1)
            ) AS primary_wallet,
            (SELECT COUNT(*) FROM wallets w WHERE w.user_id = u.id) AS wallet_count,
            u.created_at::date
        FROM users u
        WHERE {where}
        ORDER BY u.id
    """)

    if not rows:
        print(f"\n{GRAY}  No users.{R}")
        return []

    header = (
        f"{'ID':<4} {'UID':<12} {'Username':<14} {'Email':<26} "
        f"{'Role':<12} {'KYC':<10} {'V':<3} {'A':<3} "
        f"{'Primary Wallet':<16} {'W#':<3} {'Date'}"
    )
    print(f"\n  {GRAY}{header}{R}")
    print(f"  {'─' * 115}")

    for r in rows:
        if len(r) < 11:
            continue
        (uid, u_uid, uname, email, role, kyc,
         active, verified, addr, w_cnt, created) = r

        addr_s = (addr[:6] + "…" + addr[-4:]) if addr and addr not in ("", "None") else "—"
        av = f"{GREEN}✓{R}" if active == "t" else f"{RED}✗{R}"
        vv = f"{GREEN}✓{R}" if verified == "t" else f"{YELLOW}?{R}"

        line = (
            f"  {_pad(uid, 4)} {_pad(u_uid or '—', 12)} {_pad(uname, 14)} "
            f"{_pad(email, 26)} {_pad(cr(role), 22)} {_pad(ck(kyc), 20)} "
            f"{_pad(vv, 3)} {_pad(av, 3)} {_pad(addr_s, 16)} {_pad(w_cnt, 3)} {created}"
        )
        print(line)

    print(f"\n  {GRAY}Total: {len(rows)}{R}")
    return rows


# ── Детали пользователя ───────────────────────────────────────
def detail(uid: int):
    rows = psql(f"""
        SELECT
            u.id, u.uid, u.username, u.email, u.role,
            u.is_active, u.email_verified, u.created_at,
            p.full_name, p.country, p.phone, p.telegram, p.birth_date
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = {uid}
    """)
    if not rows:
        print(f"{RED}  Not found.{R}")
        return

    r = rows[0]
    hdr(f"User #{r[0]} — {r[2]}")
    fields = [
        ("ID",              r[0]),
        ("UID",             r[1] or "—"),
        ("Username",        r[2]),
        ("Email",           r[3]),
        ("Role",            cr(r[4])),
        ("Active",          "Yes" if r[5] == "t" else f"{RED}No{R}"),
        ("Email Verified",  "Yes" if r[6] == "t" else f"{YELLOW}No{R}"),
        ("Created",         r[7]),
        ("── Profile ──",   ""),
        ("Full Name",       r[8] or "—"),
        ("Country",         r[9] or "—"),
        ("Phone",           r[10] or "—"),
        ("Telegram",        r[11] or "—"),
        ("Birth Date",      r[12] or "—"),
    ]
    for label, val in fields:
        if label.startswith("──"):
            print(f"\n  {GRAY}{label}{R}")
        else:
            print(f"  {GRAY}{label:<18}{R} {val}")

    # Кошельки
    wallets = psql(f"""
        SELECT id, address, label, is_primary
        FROM wallets WHERE user_id = {uid}
        ORDER BY is_primary DESC, id
    """)
    print(f"\n  {GRAY}── Wallets ({len(wallets)}) ──{R}")
    if wallets:
        for w in wallets:
            if len(w) < 4:
                continue
            wid, addr, label, primary = w
            star = f" {YELLOW}★ primary{R}" if primary == "t" else ""
            print(f"  {GRAY}  [{wid}]{R} {addr}  {GRAY}{label or ''}{R}{star}")
    else:
        print(f"  {GRAY}  No wallets.{R}")

    # Последняя KYC-заявка
    kyc_rows = psql(f"""
        SELECT id, status, full_name, document_type, document_number,
               rejection_reason, submitted_at, reviewed_at
        FROM kyc_applications
        WHERE user_id = {uid}
        ORDER BY submitted_at DESC LIMIT 1
    """)
    print(f"\n  {GRAY}── Last KYC Application ──{R}")
    if kyc_rows:
        k = kyc_rows[0]
        kfields = [
            ("KYC ID",      k[0]),
            ("Status",      k[1] or "—"),
            ("Full Name",   k[2] or "—"),
            ("Doc Type",    k[3] or "—"),
            ("Doc Number",  k[4] or "—"),
            ("Rejection",   k[5] or "—"),
            ("Submitted",   k[6] or "—"),
            ("Reviewed",    k[7] or "—"),
        ]
        for label, val in kfields:
            print(f"  {GRAY}  {label:<16}{R} {val}")
    else:
        print(f"  {GRAY}  No KYC application.{R}")


# ── Редактор ──────────────────────────────────────────────────
def edit(uid: int) -> str | None:
    """Редактирование пользователя. Возвращает 'deleted' если юзер удалён."""
    while True:
        detail(uid)
        menu({
            "1":  "Change username",
            "2":  "Change email",
            "3":  "Change password",
            "4":  f"Change role  → {YELLOW}ADMIN{R}/{GREEN}USER{R}/{GRAY}UNVERIFIED{R}",
            "5":  "Approve KYC  → создать/обновить запись в kyc_applications + role=USER",
            "6":  "Reject KYC   → обновить последнюю заявку",
            "7":  "Reset KYC    → удалить все заявки",
            "8":  "Toggle ban   → active/inactive",
            "9":  "Verify email manually",
            "10": f"{MAGENTA}Add new wallet{R}",
            "11": f"{MAGENTA}Set primary wallet{R}",
            "12": f"{MAGENTA}Delete wallet by ID{R}",
            "13": "Edit profile (full_name, country, phone, telegram)",
            "14": f"{RED}Delete user{R}",
            "0":  "Back",
        })
        ch = inp("Action:")

        if ch == "1":
            new = inp("New username:")
            if new:
                psql_exec("UPDATE users SET username = '%s' WHERE id = %d" % (_shell_quote(new), uid))

        elif ch == "2":
            new = inp("New email:")
            if new:
                psql_exec(
                    "UPDATE users SET email = '%s', email_verified = false WHERE id = %d"
                    % (_shell_quote(new), uid)
                )

        elif ch == "3":
            pw = inp("New password:")
            if pw:
                print(f"  {GRAY}Hashing...{R}")
                hashed = bcrypt_hash(pw)
                if hashed:
                    psql_exec(
                        "UPDATE users SET hashed_password = '%s' WHERE id = %d"
                        % (_shell_quote(hashed), uid)
                    )
                else:
                    print(f"{RED}  Hash failed{R}")

        elif ch == "4":
            print(f"  Options: ADMIN / USER / UNVERIFIED")
            role = inp("New role:").upper()
            if role in ("ADMIN", "USER", "UNVERIFIED"):
                psql_exec("UPDATE users SET role = '%s' WHERE id = %d" % (role, uid))
            else:
                print(f"{RED}  Invalid role{R}")

        elif ch == "5":
            pending = psql(
                "SELECT id FROM kyc_applications WHERE user_id = %d AND status = 'PENDING' LIMIT 1" % uid
            )
            if pending:
                kyc_id = pending[0][0]
                psql_exec(
                    "UPDATE kyc_applications SET status = 'APPROVED', reviewed_at = NOW() WHERE id = %s"
                    % kyc_id
                )
            else:
                fname = inp("Full name for KYC record:") or "Manual Approval"
                psql_exec(
                    "INSERT INTO kyc_applications "
                    "(user_id, status, full_name, document_type, document_number, submitted_at, reviewed_at) "
                    "VALUES (%d, 'APPROVED', '%s', 'passport', 'MANUAL', NOW(), NOW())"
                    % (uid, _shell_quote(fname))
                )
            psql_exec("UPDATE users SET role = 'USER' WHERE id = %d" % uid)
            print(f"  {GRAY}Note: токены минтятся через блокчейн — используй Admin UI для реального минта.{R}")

        elif ch == "6":
            reason = inp("Rejection reason:") or "Documents not valid"
            pending = psql(
                "SELECT id FROM kyc_applications WHERE user_id = %d AND status = 'PENDING' LIMIT 1" % uid
            )
            if pending:
                kyc_id = pending[0][0]
                psql_exec(
                    "UPDATE kyc_applications "
                    "SET status = 'REJECTED', rejection_reason = '%s', reviewed_at = NOW() "
                    "WHERE id = %s" % (_shell_quote(reason), kyc_id)
                )
            else:
                print(f"  {YELLOW}Нет PENDING заявки — нечего отклонять.{R}")

        elif ch == "7":
            if confirm("Delete ALL kyc_applications for this user?"):
                psql_exec("DELETE FROM kyc_applications WHERE user_id = %d" % uid)

        elif ch == "8":
            rows = psql("SELECT is_active FROM users WHERE id = %d" % uid)
            if rows:
                new_val = "false" if rows[0][0] == "t" else "true"
                psql_exec("UPDATE users SET is_active = %s WHERE id = %d" % (new_val, uid))

        elif ch == "9":
            psql_exec("UPDATE users SET email_verified = true WHERE id = %d" % uid)

        elif ch == "10":
            print(f"  {GRAY}Генерируем новый ETH кошелёк...{R}")
            label = inp("Label (e.g. 'Cold wallet') [New wallet]:") or "New wallet"
            make_primary = inp("Сделать основным? (yes/no) [no]:").lower() in ("yes", "y")

            addr, enc_key = eth_wallet()
            if not addr:
                print(f"{RED}  Не удалось сгенерировать кошелёк.{R}")
                input(f"\n  {GRAY}Press Enter...{R}")
                continue

            if make_primary:
                psql_exec("UPDATE wallets SET is_primary = false WHERE user_id = %d" % uid, silent=True)

            is_prim = "true" if make_primary else "false"
            psql_exec(
                "INSERT INTO wallets (user_id, address, label, encrypted_private_key, is_primary) "
                "VALUES (%d, '%s', '%s', '%s', %s)"
                % (uid, _shell_quote(addr), _shell_quote(label), _shell_quote(enc_key), is_prim)
            )
            print(f"  {GREEN}New address: {addr}{R}")

        elif ch == "11":
            wallets = psql(
                "SELECT id, address, label FROM wallets WHERE user_id = %d ORDER BY id" % uid
            )
            if not wallets:
                print(f"{RED}  No wallets.{R}")
            else:
                for w in wallets:
                    print(f"  [{w[0]}] {w[1]}  {GRAY}{w[2] or ''}{R}")
                wid = inp("Wallet ID to set as primary:")
                if wid.isdigit():
                    psql_exec("UPDATE wallets SET is_primary = false WHERE user_id = %d" % uid, silent=True)
                    psql_exec(
                        "UPDATE wallets SET is_primary = true WHERE id = %s AND user_id = %d"
                        % (wid, uid)
                    )

        elif ch == "12":
            wallets = psql(
                "SELECT id, address, label, is_primary FROM wallets WHERE user_id = %d ORDER BY id" % uid
            )
            if not wallets:
                print(f"{RED}  No wallets.{R}")
            else:
                for w in wallets:
                    star = f" {YELLOW}★{R}" if w[3] == "t" else ""
                    print(f"  [{w[0]}] {w[1]}  {GRAY}{w[2] or ''}{R}{star}")
                wid = inp("Wallet ID to delete:")
                if wid.isdigit():
                    if confirm(f"Delete wallet #{wid}?"):
                        psql_exec("DELETE FROM wallets WHERE id = %s AND user_id = %d" % (wid, uid))

        elif ch == "13":
            psql_exec(
                "INSERT INTO profiles (user_id) VALUES (%d) ON CONFLICT (user_id) DO NOTHING" % uid,
                silent=True
            )
            print(f"  {GRAY}Enter new values (Enter = не менять):{R}")
            fname   = inp("Full name:")
            country = inp("Country:")
            phone   = inp("Phone:")
            tg      = inp("Telegram:")
            sets = []
            if fname:
                sets.append("full_name = '%s'" % _shell_quote(fname))
            if country:
                sets.append("country = '%s'" % _shell_quote(country))
            if phone:
                sets.append("phone = '%s'" % _shell_quote(phone))
            if tg:
                sets.append("telegram = '%s'" % _shell_quote(tg))
            if sets:
                psql_exec("UPDATE profiles SET %s WHERE user_id = %d" % (', '.join(sets), uid))
            else:
                print(f"  {GRAY}Ничего не изменено.{R}")

        elif ch == "14":
            if confirm(f"DELETE user #{uid} permanently?"):
                # Каскадное удаление зависимых записей в правильном порядке
                deps = [
                    ("kyc_applications", "user_id"),
                    ("notifications",    "user_id"),
                    ("user_tokens",      "user_id"),
                    ("conversation_participants", "user_id"),
                    ("wallets",          "user_id"),
                    ("profiles",         "user_id"),
                ]
                # Сначала удалить messages (sender_id) и transactions, зависящие от wallets
                psql_exec(
                    "DELETE FROM messages WHERE sender_id = %d" % uid, silent=True
                )
                psql_exec(
                    "DELETE FROM transactions "
                    "WHERE from_wallet_id IN (SELECT id FROM wallets WHERE user_id = %d) "
                    "OR to_wallet_id IN (SELECT id FROM wallets WHERE user_id = %d)"
                    % (uid, uid), silent=True
                )
                for table, col in deps:
                    psql_exec("DELETE FROM %s WHERE %s = %d" % (table, col, uid), silent=True)
                psql_exec("DELETE FROM users WHERE id = %d" % uid)
                print(f"  {GREEN}User #{uid} deleted.{R}")
                return "deleted"

        elif ch == "0":
            return None

        else:
            print(f"{RED}  Invalid{R}")

        input(f"\n  {GRAY}Press Enter to continue...{R}")


# ── Создать юзера ─────────────────────────────────────────────
def create_user():
    hdr("Create New User")
    username = inp("Username:")
    email    = inp("Email:")
    password = inp("Password:")
    role     = inp("Role (UNVERIFIED/USER/ADMIN) [UNVERIFIED]:") or "UNVERIFIED"

    if not all([username, email, password]):
        print(f"{RED}  All fields required.{R}")
        return

    print(f"  {GRAY}Hashing password...{R}")
    hashed = bcrypt_hash(password)
    if not hashed:
        print(f"{RED}  Hash failed.{R}")
        return

    psql_exec(
        "INSERT INTO users "
        "(email, username, hashed_password, role, is_active, email_verified, created_at, updated_at) "
        "VALUES ('%s', '%s', '%s', '%s', true, true, NOW(), NOW())"
        % (_shell_quote(email), _shell_quote(username), _shell_quote(hashed), role.upper())
    )

    rows = psql("SELECT id FROM users WHERE email = '%s'" % _shell_quote(email))
    if not rows:
        print(f"{RED}  Could not find created user.{R}")
        return

    uid = int(rows[0][0])

    # Создаём профиль
    psql_exec("INSERT INTO profiles (user_id) VALUES (%d)" % uid, silent=True)

    # Создаём кошелёк
    print(f"  {GRAY}Creating wallet...{R}")
    addr, enc_key = eth_wallet()
    if addr:
        psql_exec(
            "INSERT INTO wallets (user_id, address, label, encrypted_private_key, is_primary) "
            "VALUES (%d, '%s', 'Main wallet', '%s', true)"
            % (uid, _shell_quote(addr), _shell_quote(enc_key))
        )

    # Если USER — сразу создаём одобренную KYC-заявку
    if role.upper() == "USER":
        psql_exec(
            "INSERT INTO kyc_applications "
            "(user_id, status, full_name, document_type, document_number, submitted_at, reviewed_at) "
            "VALUES (%d, 'APPROVED', '%s', 'passport', 'MANUAL', NOW(), NOW())"
            % (uid, _shell_quote(username)),
            silent=True,
        )

    print(f"\n  {GREEN}✅ User created!{R}")
    print(f"  {GRAY}ID: {uid} | Address: {addr}{R}")


# ── Статистика ────────────────────────────────────────────────
def stats():
    hdr("Platform Statistics")
    queries = [
        ("Total users",       "SELECT COUNT(*) FROM users"),
        ("Admins",            "SELECT COUNT(*) FROM users WHERE role = 'ADMIN'"),
        ("Users (KYC ok)",    "SELECT COUNT(*) FROM users WHERE role = 'USER'"),
        ("Unverified",        "SELECT COUNT(*) FROM users WHERE role = 'UNVERIFIED'"),
        ("─── KYC ───",       None),
        ("KYC Pending",       "SELECT COUNT(*) FROM kyc_applications WHERE status = 'PENDING'"),
        ("KYC Approved",      "SELECT COUNT(*) FROM kyc_applications WHERE status = 'APPROVED'"),
        ("KYC Rejected",      "SELECT COUNT(*) FROM kyc_applications WHERE status = 'REJECTED'"),
        ("─── Wallets ───",   None),
        ("Total wallets",     "SELECT COUNT(*) FROM wallets"),
        ("Primary wallets",   "SELECT COUNT(*) FROM wallets WHERE is_primary = true"),
        ("─── Activity ───",  None),
        ("Total messages",    "SELECT COUNT(*) FROM messages"),
        ("Conversations",     "SELECT COUNT(*) FROM conversations"),
        ("Total transactions","SELECT COUNT(*) FROM transactions"),
        ("Pending tokens",    "SELECT COUNT(*) FROM user_tokens WHERE used = false"),
        ("Active bans",       "SELECT COUNT(*) FROM users WHERE is_active = false"),
    ]
    for label, q in queries:
        if q is None:
            print(f"\n  {CYAN}{label}{R}")
        else:
            rows = psql(q)
            val = rows[0][0] if rows else "—"
            print(f"  {GRAY}{label:<22}{R} {B}{val}{R}")


# ── Поиск ─────────────────────────────────────────────────────
def search(q: str):
    safe = _shell_quote(q)
    list_users(f"""
        u.username ILIKE '%%{safe}%%'
        OR u.email ILIKE '%%{safe}%%'
        OR u.uid ILIKE '%%{safe}%%'
        OR EXISTS (
            SELECT 1 FROM wallets w
            WHERE w.user_id = u.id AND w.address ILIKE '%%{safe}%%'
        )
    """)


# ── MAIN ──────────────────────────────────────────────────────
def main():
    print(f"\n{RED}{B}  ⚠  CHEAT SCRIPT — Dev only, never use in production!{R}")
    print(f"{CYAN}{B}  ⬡ DeFi Platform — User Manager{R}")

    while True:
        menu({
            "1": "List all users",
            "2": "Search  (username / email / uid / wallet)",
            "3": "Edit user by ID",
            "4": "Create user",
            "5": f"KYC Queue  {YELLOW}(pending){R}",
            "6": "Statistics",
            "0": f"{GRAY}Exit{R}",
        })
        ch = inp("Choose:")

        if ch == "1":
            list_users()

        elif ch == "2":
            q = inp("Search query:")
            if q:
                search(q)

        elif ch == "3":
            list_users()
            uid_str = inp("User ID:")
            if uid_str.isdigit():
                edit(int(uid_str))

        elif ch == "4":
            create_user()

        elif ch == "5":
            rows = psql("""
                SELECT k.id, u.id, u.uid, u.username, u.email,
                       k.full_name, k.document_type, k.document_number, k.submitted_at
                FROM kyc_applications k
                JOIN users u ON u.id = k.user_id
                WHERE k.status = 'PENDING'
                ORDER BY k.submitted_at
            """)
            if not rows:
                print(f"\n{GRAY}  No pending KYC applications.{R}")
            else:
                header = (
                    f"{'KYC ID':<8} {'User ID':<8} {'UID':<12} {'Username':<14} "
                    f"{'Email':<26} {'Full Name':<20} {'Doc':<16} {'Submitted'}"
                )
                print(f"\n  {GRAY}{header}{R}")
                print(f"  {'─' * 110}")
                for r in rows:
                    doc = (r[6] or "") + " " + (r[7] or "")
                    sub = (r[8] or "—")[:19]
                    print(f"  {_pad(r[0], 8)} {_pad(r[1], 8)} {_pad(r[2] or '—', 12)} "
                          f"{_pad(r[3], 14)} {_pad(r[4], 26)} {_pad(r[5] or '—', 20)} "
                          f"{_pad(doc, 16)} {sub}")
                uid_str = inp("\nUser ID to review (Enter to skip):")
                if uid_str.isdigit():
                    edit(int(uid_str))

        elif ch == "6":
            stats()

        elif ch == "0":
            print(f"\n{GRAY}  Bye!{R}\n")
            sys.exit(0)

        else:
            print(f"{RED}  Invalid{R}")

        input(f"\n  {GRAY}Press Enter...{R}")


if __name__ == "__main__":
    main()