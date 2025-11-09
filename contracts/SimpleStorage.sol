// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 Multi Network Smart Contract Studio – SimpleStorage.sol
 Purpose: Minimal example contract used by the Smart Contract Playground.
 Features:
 - Stores a single string message on-chain.
 - setMessage(string) updates the message.
 - getMessage() reads the current message.
 Notes for beginners:
 - This contract is great for learning deployment and transaction flow.
*/
contract SimpleStorage {
    string private message = "Hello";

    function setMessage(string memory _message) public {
        message = _message;
    }

    function getMessage() public view returns (string memory) {
        return message;
    }
}