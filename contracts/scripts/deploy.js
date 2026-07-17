const hre = require("hardhat");

async function main() {
  const verifierAddress = process.env.VERIFIER_ADDRESS;
  if (!verifierAddress) {
    throw new Error("Set VERIFIER_ADDRESS in .env — the backend wallet that will call checkIn()");
  }

  const CommitmentDevice = await hre.ethers.getContractFactory("CommitmentDevice");
  const contract = await CommitmentDevice.deploy(verifierAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CommitmentDevice deployed to:", address);
  console.log("Verifier address:", verifierAddress);
  console.log("Explorer:", `https://testnet.monadexplorer.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
