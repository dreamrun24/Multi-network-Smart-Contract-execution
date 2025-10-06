import { network } from "hardhat";

const { viem } = await network.connect();
const simpleStorage = await viem.deployContract("SimpleStorage");
console.log("Contract deployed successfully at", simpleStorage.address);