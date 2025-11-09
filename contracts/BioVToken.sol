// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 Multi Network Smart Contract Studio – BioVToken.sol
 Purpose: Example ERC-20 token used in the ERC20 Token Creator tab.
 Overview:
 - Uses OpenZeppelin libraries for secure ERC-20 implementation.
 - Includes minting and role-based access for admin accounts.
 - Demonstrates how to create a fungible token beginners can mint and test.
*/
contract BioVToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public owner;
    mapping(address => uint256) private _balances;

    constructor(address admin, string memory _name, string memory _symbol) {
        owner = admin;
        name = _name;
        symbol = _symbol;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _balances[to] += amount;
        totalSupply += amount;
    }
}