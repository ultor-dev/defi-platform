// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DeFiPlatformToken
 * @notice ERC-20 токен для платформы. Только Owner (бэкенд-кошелёк) может минтить.
 */
contract DeFiPlatformToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18; // 100M токенов

    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    constructor(address initialOwner)
        ERC20("DeFi Platform Token", "DPT")
        Ownable(initialOwner)
    {}

    /**
     * @notice Минт токенов верифицированному пользователю (вызывает бэкенд).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Burn токенов (пользователь сжигает свои).
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }
}
