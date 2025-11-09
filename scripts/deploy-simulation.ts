/*
 Multi Network Smart Contract Studio – scripts/deploy-simulation.ts
 Purpose: Dry-run like simulation script for deployments and interactions.
 Usage:
 - Useful for inspecting gas estimates and simulating calls locally.
 - Run: `npx ts-node scripts/deploy-simulation.ts`
*/
import { network } from "hardhat";

const { viem } = await network.connect();
const simpleStorage = await viem.deployContract("SimpleStorage");
console.log("Contract deployed successfully at", simpleStorage.address);