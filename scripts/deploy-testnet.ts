import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const simpleStorage = await viem.deployContract("SimpleStorage");
  console.log("Contract deployed successfully at", simpleStorage.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});