// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/*
 Multi Network Smart Contract Studio – Counter.sol
 Purpose: Simple counter contract used for testing deployments and calls.
 Functions:
 - increment() increases the counter by one.
 - get() returns the current counter value.
 Notes:
 - Great for demonstrating transactions and reads in Hardhat tests.
*/
contract Counter {
  uint public x;

  event Increment(uint by);

  function inc() public {
    x++;
    emit Increment(1);
  }

  function incBy(uint by) public {
    require(by > 0, "incBy: increment should be positive");
    x += by;
    emit Increment(by);
  }
}
