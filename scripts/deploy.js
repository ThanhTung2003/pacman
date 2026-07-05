import { network } from 'hardhat';

async function main() {
  console.log('Deploying PacmanFees contract...');

  const { ethers } = await network.create('base');
  const pacmanFees = await ethers.deployContract('PacmanFees');

  await pacmanFees.waitForDeployment();

  console.log('PacmanFees deployed to:', await pacmanFees.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
