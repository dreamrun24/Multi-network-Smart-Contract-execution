// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 Multi Network Smart Contract Studio – SimpleNFT.sol
 Purpose: Minimal ERC-721-like NFT contract for the ERC721 NFT Creator tab.
 Highlights:
 - Owner-only mint to keep beginner flows safe.
 - Tracks token ownership and tokenURI metadata.
 - Omits transfers for simplicity (no marketplace complexity).
*/
contract SimpleNFT {
    string public name;
    string public symbol;
    address public owner;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balance;
    mapping(uint256 => string) private _tokenURI;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(address admin, string memory _name, string memory _symbol) {
        owner = admin;
        name = _name;
        symbol = _symbol;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'Not owner');
        _;
    }

    function balanceOf(address account) external view returns (uint256) {
        require(account != address(0), 'Zero address');
        return _balance[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _ownerOf[tokenId];
        require(o != address(0), 'Token does not exist');
        return o;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf[tokenId] != address(0), 'Token does not exist');
        return _tokenURI[tokenId];
    }

    function mint(address to, uint256 tokenId, string memory uri) external onlyOwner {
        require(to != address(0), 'Zero address');
        require(_ownerOf[tokenId] == address(0), 'Already minted');
        _ownerOf[tokenId] = to;
        _balance[to] += 1;
        _tokenURI[tokenId] = uri;
        emit Transfer(address(0), to, tokenId);
    }

    // Minimal ERC165 interface detection for ERC721 & metadata
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd /* ERC721 */ || interfaceId == 0x5b5e139f /* ERC721Metadata */;
    }
}