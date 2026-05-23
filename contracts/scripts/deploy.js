const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const Token = await ethers.getContractFactory("DeFiPlatformToken");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("✅ DeFiPlatformToken deployed to:", address);
  console.log("\n👉 Добавь в .env:");
  console.log(`TOKEN_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
