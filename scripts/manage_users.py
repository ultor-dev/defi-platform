#!/usr/bin/env python3
"""
DeFi Platform — CHEAT SCRIPT
Полное управление БД. Только для разработки!
"""
import subprocess
import sys
import secrets
import hashlib

PROJECT_DIR = "/home/ultor/projects/defi-platform"

# ── Цвета ─────────────────────────────────────────────────────
R="\033[0m"; B="\033[1m"; CYAN="\033[96m"; GREEN="\033[92m"
YELLOW="\033[93m"; RED="\033[91m"; GRAY="\033[90m"; BLUE="\033[94m"
MAGENTA="\033[95m"

def psql(query: str) -> list:
    cmd = ["docker","compose","exec","-T","db","psql","-U","defi","-d","defidb","-t","-A","-F","\t","-c",query]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    if r.returncode != 0:
        print(f"{RED}DB Error: {r.stderr}{R}"); return []
    lines = [l for l in r.stdout.strip().split("\n") if l]
    return [l.split("\t") for l in lines]

def psql_exec(query: str, silent=False) -> bool:
    cmd = ["docker","compose","exec","-T","db","psql","-U","defi","-d","defidb","-c",query]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    if r.returncode != 0:
        print(f"{RED}Error: {r.stderr}{R}"); return False
    if not silent:
        out = r.stdout.strip()
        if "UPDATE 1" in out or "DELETE" in out or "INSERT" in out:
            print(f"{GREEN}✅ Done{R}")
        else:
            print(f"{GRAY}{out}{R}")
    return True

def bcrypt_hash(password: str) -> str:
    """Хешируем через Python внутри backend контейнера."""
    cmd = ["docker","compose","exec","-T","backend","python3","-c",
           f"from passlib.context import CryptContext; ctx=CryptContext(schemes=['bcrypt']); print(ctx.hash('{password}'))"]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    return r.stdout.strip()

def eth_wallet() -> tuple:
    """Генерируем новый ETH кошелёк через backend контейнер."""
    cmd = ["docker","compose","exec","-T","backend","python3","-c",
           "from app.services.wallet_service import generate_wallet; import json; print(json.dumps(generate_wallet()))"]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_DIR)
    import json
    data = json.loads(r.stdout.strip())
    return data["address"], data["encrypted_private_key"]

def cr(role):
    return {
        "ADMIN": f"{YELLOW}{B}ADMIN{R}",
        "USER": f"{GREEN}USER{R}",
        "UNVERIFIED": f"{GRAY}UNVERIFIED{R}",
    }.get(role, role)

def ck(kyc):
    return {
        "APPROVED": f"{GREEN}APPROVED{R}",
        "PENDING": f"{YELLOW}PENDING{R}",
        "REJECTED": f"{RED}REJECTED{R}",
        "NONE": f"{GRAY}NONE{R}",
    }.get(kyc, kyc)

def hdr(text):
    print(f"\n{CYAN}{B}{'═'*55}{R}")
    print(f"{CYAN}{B}  {text}{R}")
    print(f"{CYAN}{B}{'═'*55}{R}")

def menu(opts: dict):
    print()
    for k,v in opts.items():
        print(f"  {BLUE}{B}[{k}]{R} {v}")
    print()

def inp(prompt, default=""):
    val = input(f"  {B}{prompt}{R} ").strip()
    return val if val else default

def confirm(msg):
    return inp(f"{RED}{msg} (yes/no):{R}").lower() == "yes"


# ── Список ────────────────────────────────────────────────────
def list_users(where="1=1"):
    rows = psql(f"""
        SELECT u.id, u.username, u.email, u.role, u.kyc_status,
               u.is_active, u.email_verified, w.address, u.created_at::date
        FROM users u LEFT JOIN wallets w ON u.id=w.user_id
        WHERE {where} ORDER BY u.id
    """)
    if not rows or rows==[['']]:
        print(f"\n{GRAY}  No users.{R}"); return []

    print(f"\n  {GRAY}{'ID':<4} {'Username':<14} {'Email':<26} {'Role':<12} {'KYC':<10} {'V':<3} {'A':<3} {'Wallet':<14} {'Date'}{R}")
    print(f"  {'─'*95}")
    for r in rows:
        if len(r)<9: continue
        uid,uname,email,role,kyc,active,verified,addr,created = r
        addr_s = (addr[:8]+"…"+addr[-4:]) if addr and addr!="" else "—"
        av = f"{GREEN}✓{R}" if active=="t" else f"{RED}✗{R}"
        vv = f"{GREEN}✓{R}" if verified=="t" else f"{YELLOW}?{R}"
        print(f"  {uid:<4} {uname:<14} {email:<26} {cr(role):<22} {ck(kyc):<20} {vv:<3} {av:<3} {addr_s:<14} {created}")
    print(f"\n  {GRAY}Total: {len(rows)}{R}")
    return rows


# ── Детали ────────────────────────────────────────────────────
def detail(uid):
    rows = psql(f"""
        SELECT u.id,u.username,u.email,u.role,u.kyc_status,u.is_active,u.email_verified,
               u.kyc_full_name,u.kyc_document_type,u.kyc_document_number,
               u.kyc_submitted_at,u.kyc_reviewed_at,u.kyc_rejection_reason,
               w.address,u.created_at
        FROM users u LEFT JOIN wallets w ON u.id=w.user_id
        WHERE u.id={uid}
    """)
    if not rows or rows==[['']]:
        print(f"{RED}  Not found.{R}"); return
    r = rows[0]
    hdr(f"User #{r[0]} — {r[1]}")
    fields = [
        ("ID",r[0]),("Username",r[1]),("Email",r[2]),
        ("Role",cr(r[3])),("KYC",ck(r[4])),
        ("Active","Yes" if r[5]=="t" else f"{RED}No{R}"),
        ("Email Verified","Yes" if r[6]=="t" else f"{YELLOW}No{R}"),
        ("KYC Name",r[7] or "—"),("Doc Type",r[8] or "—"),
        ("Doc Number",r[9] or "—"),
        ("KYC Submitted",r[10] or "—"),("KYC Reviewed",r[11] or "—"),
        ("Rejection",r[12] or "—"),
        ("Wallet",r[13] or "—"),("Created",r[14]),
    ]
    for label,val in fields:
        print(f"  {GRAY}{label:<18}{R} {val}")


# ── Редактор ──────────────────────────────────────────────────
def edit(uid):
    # Крутимся в петле — после каждого действия снова показываем меню
    while True:
        detail(uid)
        menu({
            "1":  "Change username",
            "2":  "Change email",
            "3":  "Change password",
            "4":  f"Change role  → {YELLOW}ADMIN{R}/{GREEN}USER{R}/{GRAY}UNVERIFIED{R}",
            "5":  "Approve KYC  → role=USER + 100 tokens",
            "6":  "Reject KYC",
            "7":  "Reset KYC    → back to NONE",
            "8":  "Toggle ban   → active/inactive",
            "9":  "Verify email manually",
            "10": f"{MAGENTA}Generate new wallet{R}",
            "11": f"{MAGENTA}Set custom wallet address{R}",
            "12": f"{MAGENTA}Give tokens (mint via SQL){R}",
            "13": f"{RED}Delete user{R}",
            "0":  "Back",
        })
        ch = inp("Action:")

        if ch=="1":
            new = inp("New username:")
            if new: psql_exec(f"UPDATE users SET username='{new}' WHERE id={uid}")

        elif ch=="2":
            new = inp("New email:")
            if new: psql_exec(f"UPDATE users SET email='{new}',email_verified=false WHERE id={uid}")

        elif ch=="3":
            pw = inp("New password:")
            if pw:
                print(f"  {GRAY}Hashing...{R}")
                hashed = bcrypt_hash(pw)
                if hashed:
                    psql_exec(f"UPDATE users SET hashed_password='{hashed}' WHERE id={uid}")
                else:
                    print(f"{RED}  Hash failed{R}")

        elif ch=="4":
            print(f"  Options: ADMIN / USER / UNVERIFIED")
            role = inp("New role:").upper()
            if role in ("ADMIN","USER","UNVERIFIED"):
                psql_exec(f"UPDATE users SET role='{role}' WHERE id={uid}")
            else:
                print(f"{RED}  Invalid role{R}")

        elif ch=="5":
            psql_exec(f"UPDATE users SET kyc_status='APPROVED',role='USER',kyc_reviewed_at=NOW() WHERE id={uid}")
            print(f"  {GRAY}Note: токены минтятся через блокчейн, здесь только статус в БД.{R}")

        elif ch=="6":
            reason = inp("Rejection reason:") or "Documents not valid"
            psql_exec(f"UPDATE users SET kyc_status='REJECTED',kyc_rejection_reason='{reason}',kyc_reviewed_at=NOW() WHERE id={uid}")

        elif ch=="7":
            psql_exec(f"""UPDATE users SET
                kyc_status='NONE',kyc_full_name=NULL,kyc_document_type=NULL,
                kyc_document_number=NULL,kyc_submitted_at=NULL,
                kyc_reviewed_at=NULL,kyc_rejection_reason=NULL
                WHERE id={uid}""")

        elif ch=="8":
            rows = psql(f"SELECT is_active FROM users WHERE id={uid}")
            if rows:
                new_val = "false" if rows[0][0]=="t" else "true"
                psql_exec(f"UPDATE users SET is_active={new_val} WHERE id={uid}")

        elif ch=="9":
            psql_exec(f"UPDATE users SET email_verified=true WHERE id={uid}")

        elif ch=="10":
            if confirm("Generate new wallet? Old wallet will be replaced"):
                print(f"  {GRAY}Generating...{R}")
                addr, enc_key = eth_wallet()
                psql_exec(f"DELETE FROM wallets WHERE user_id={uid}", silent=True)
                psql_exec(f"INSERT INTO wallets (user_id,address,encrypted_private_key,created_at) VALUES ({uid},'{addr}','{enc_key}',NOW())")
                print(f"  {GREEN}New address: {addr}{R}")

        elif ch=="11":
            addr = inp("Wallet address (0x...):")
            if addr.startswith("0x") and len(addr)==42:
                psql_exec(f"UPDATE wallets SET address='{addr}' WHERE user_id={uid}")
            else:
                print(f"{RED}  Invalid address{R}")

        elif ch=="12":
            print(f"  {GRAY}Это только пометка в БД — не реальный минт в блокчейн.{R}")
            print(f"  {GRAY}Для реального минта используй Admin Panel в браузере.{R}")
            amount = inp("Amount DPT to record:")
            note = inp("Note (optional):")
            print(f"  {YELLOW}Real mint → используй: bash scripts/dev.sh deploy-contract + Admin UI{R}")

        elif ch=="13":
            if confirm(f"DELETE user #{uid} permanently?"):
                psql_exec(f"DELETE FROM wallets WHERE user_id={uid}", silent=True)
                psql_exec(f"DELETE FROM user_tokens WHERE user_id={uid}", silent=True)
                psql_exec(f"DELETE FROM conversation_participants WHERE user_id={uid}", silent=True)
                psql_exec(f"DELETE FROM messages WHERE sender_id={uid}", silent=True)
                psql_exec(f"DELETE FROM users WHERE id={uid}")
                print(f"  {GREEN}User #{uid} deleted.{R}")
                return "deleted"  # выходим из петли после удаления

        elif ch=="0":
            return  # просто выходим назад в главное меню

        else:
            print(f"{RED}  Invalid{R}")
            continue

        # После каждого успешного действия — пауза, чтобы увидеть результат,
        # затем петля сама обновит detail() сверху
        input(f"\n  {GRAY}Press Enter to continue editing...{R}")


# ── Создать юзера ─────────────────────────────────────────────
def create_user():
    hdr("Create New User")
    username = inp("Username:")
    email = inp("Email:")
    password = inp("Password:")
    role = inp("Role (UNVERIFIED/USER/ADMIN) [UNVERIFIED]:") or "UNVERIFIED"
    kyc = inp("KYC status (NONE/APPROVED) [NONE]:") or "NONE"

    if not all([username, email, password]):
        print(f"{RED}  All fields required.{R}"); return

    print(f"  {GRAY}Hashing password...{R}")
    hashed = bcrypt_hash(password)
    if not hashed:
        print(f"{RED}  Hash failed.{R}"); return

    psql_exec(f"""
        INSERT INTO users (email,username,hashed_password,role,kyc_status,is_active,email_verified,created_at,updated_at)
        VALUES ('{email}','{username}','{hashed}','{role.upper()}','{kyc.upper()}',true,true,NOW(),NOW())
    """)

    rows = psql(f"SELECT id FROM users WHERE email='{email}'")
    if rows and rows[0][0]:
        uid = rows[0][0]
        print(f"  {GRAY}Creating wallet...{R}")
        addr, enc_key = eth_wallet()
        psql_exec(f"INSERT INTO wallets (user_id,address,encrypted_private_key,created_at) VALUES ({uid},'{addr}','{enc_key}',NOW())")
        print(f"\n  {GREEN}✅ User created!{R}")
        print(f"  {GRAY}ID: {uid} | Address: {addr}{R}")


# ── Статистика ────────────────────────────────────────────────
def stats():
    hdr("Platform Statistics")
    for label, q in [
        ("Total users",     "SELECT COUNT(*) FROM users"),
        ("Admins",          "SELECT COUNT(*) FROM users WHERE role='ADMIN'"),
        ("Users (KYC ok)",  "SELECT COUNT(*) FROM users WHERE role='USER'"),
        ("Unverified",      "SELECT COUNT(*) FROM users WHERE role='UNVERIFIED'"),
        ("KYC Pending",     "SELECT COUNT(*) FROM users WHERE kyc_status='PENDING'"),
        ("KYC Approved",    "SELECT COUNT(*) FROM users WHERE kyc_status='APPROVED'"),
        ("Active",          "SELECT COUNT(*) FROM users WHERE is_active=true"),
        ("Banned",          "SELECT COUNT(*) FROM users WHERE is_active=false"),
        ("Total wallets",   "SELECT COUNT(*) FROM wallets"),
        ("Total messages",  "SELECT COUNT(*) FROM messages"),
        ("Conversations",   "SELECT COUNT(*) FROM conversations"),
        ("Pending tokens",  "SELECT COUNT(*) FROM user_tokens WHERE used=false"),
    ]:
        rows = psql(q)
        val = rows[0][0] if rows and rows[0] else "—"
        print(f"  {GRAY}{label:<22}{R} {B}{val}{R}")


# ── Поиск ─────────────────────────────────────────────────────
def search(q):
    list_users(f"u.username ILIKE '%{q}%' OR u.email ILIKE '%{q}%' OR w.address ILIKE '%{q}%'")


# ── MAIN ──────────────────────────────────────────────────────
def main():
    print(f"\n{RED}{B}  ⚠  CHEAT SCRIPT — Dev only, never use in production!{R}")
    print(f"{CYAN}{B}  ⬡ DeFi Platform — User Manager{R}")

    while True:
        menu({
            "1": "List all users",
            "2": "Search",
            "3": "Edit user by ID",
            "4": "Create user",
            "5": f"KYC Queue  {YELLOW}(pending){R}",
            "6": "Statistics",
            "0": f"{GRAY}Exit{R}",
        })
        ch = inp("Choose:")

        if ch=="1":
            list_users()

        elif ch=="2":
            q = inp("Search (name/email/wallet):")
            if q: search(q)

        elif ch=="3":
            list_users()
            uid = inp("User ID:")
            if uid.isdigit():
                result = edit(uid)
                if result=="deleted": continue
            continue  # после edit() не нужен лишний "Press Enter" снизу

        elif ch=="4":
            create_user()

        elif ch=="5":
            rows = list_users("u.kyc_status='PENDING'")
            if rows and rows!=[['']]:
                uid = inp("ID to review (Enter to skip):")
                if uid.isdigit(): edit(uid)

        elif ch=="6":
            stats()

        elif ch=="0":
            print(f"\n{GRAY}  Bye!{R}\n"); sys.exit(0)

        else:
            print(f"{RED}  Invalid{R}")

        input(f"\n  {GRAY}Press Enter...{R}")

if __name__=="__main__":
    main()