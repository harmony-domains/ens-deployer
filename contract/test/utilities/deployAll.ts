// import { HardhatRuntimeEnvironment } from 'hardhat/types'
import hre, { ethers } from 'hardhat'

export async function deploy (context) {
  // Deploy Price Oracles
  const ORACLE_UNIT_PRICE = parseInt(process.env.ORACLE_PRICE_PER_SECOND_IN_WEIS || '3')
  console.log('ORACLE_UNIT_PRICE', ORACLE_UNIT_PRICE)
  const { deployments: { deploy }, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  console.log('deployer account', deployer)
  const TLD = process.env.TLD || 'country'
  //   console.log('deploying OracleDeployer')
  const OracleDeployer = await deploy('OracleDeployer', { from: deployer, args: [1, [ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE]] })
  //   console.log('OracleDeployerDeployed')
  context.oracleDeployer = await ethers.getContractAt('OracleDeployer', OracleDeployer.address)
  const priceOracleAddress = await context.oracleDeployer.oracle()
  context.priceOracle = await ethers.getContractAt('StablePriceOracle', priceOracleAddress)
  const usdOracleAddress = await context.oracleDeployer.usdOracle()
  context.usdOracle = await ethers.getContractAt('StablePriceOracle', usdOracleAddress)
  console.log('- oracleDeployer:', context.oracleDeployer.address)
  console.log('- priceOracle:', context.priceOracle.address)
  console.log('- usdOracle:', await context.usdOracle.address)

  // Deploy ENS Deployers
  const ENSUtils = await deploy('ENSUtils', { from: deployer })
  const ENSRegistryDeployer = await deploy('ENSRegistryDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSNFTDeployer = await deploy('ENSNFTDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSControllerDeployer = await deploy('ENSControllerDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSPublicResolverDeployer = await deploy('ENSPublicResolverDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSDeployer = await deploy('ENSDeployer', {
    from: deployer,
    args: [TLD, context.priceOracle.address],
    log: true,
    autoMine: true,
    libraries: {
      ENSUtils: ENSUtils.address,
      ENSRegistryDeployer: ENSRegistryDeployer.address,
      ENSNFTDeployer: ENSNFTDeployer.address,
      ENSControllerDeployer: ENSControllerDeployer.address,
      ENSPublicResolverDeployer: ENSPublicResolverDeployer.address
    }
  })
  context.ensDeployer = await ethers.getContractAt('ENSDeployer', ENSDeployer.address)
  console.log('- ENSDeployer deployed to:', context.ensDeployer.address)
  console.log('- ens deployed to:', await context.ensDeployer.ens())
  context.ens = await ethers.getContractAt('ENSRegistry', await context.ensDeployer.ens())

  console.log('- fifsRegistrar deployed to:', await context.ensDeployer.fifsRegistrar())
  context.fifsRegistrar = await ethers.getContractAt('FIFSRegistrar', await context.ensDeployer.fifsRegistrar())
  console.log('- reverseRegistrar deployed to:', await context.ensDeployer.reverseRegistrar())
  context.reverseRegistrar = await ethers.getContractAt('ReverseRegistrar', await context.ensDeployer.reverseRegistrar())
  console.log('- baseRegistrar deployed to:', await context.ensDeployer.baseRegistrar())
  context.baseRegistrar = await ethers.getContractAt('BaseRegistrarImplementation', await context.ensDeployer.baseRegistrar())

  console.log('- metadataService deployed to:', await context.ensDeployer.metadataService())
  context.metadataService = await ethers.getContractAt('StaticMetadataService', await context.ensDeployer.metadataService())
  console.log('- nameWrapper deployed to:', await context.ensDeployer.nameWrapper())
  context.nameWrapper = await ethers.getContractAt('TLDNameWrapper', await context.ensDeployer.nameWrapper())

  console.log('- registrarController deployed to:', await context.ensDeployer.registrarController())
  context.registrarController = await ethers.getContractAt('RegistrarController', await context.ensDeployer.registrarController())

  console.log('- publicResolver deployed to:', await context.ensDeployer.publicResolver())
  context.publicResolver = await ethers.getContractAt('PublicResolver', await context.ensDeployer.publicResolver())

  console.log('- universalResolver deployed to:', await context.ensDeployer.universalResolver())
  context.universalResolver = await ethers.getContractAt('PublicResolver', await context.ensDeployer.universalResolver())

  const receipt = await context.ensDeployer.transferOwner(TLD, deployer).then(tx => tx.wait())
  console.log('ensDeployer.transferOwner tx', receipt.transactionHash)
  const ens = await ethers.getContractAt('ENSRegistry', await context.ensDeployer.ens())
  console.log('ens owner:', await ens.owner(new Uint8Array(32)))
  const resolverNode = ethers.utils.keccak256(ethers.utils.concat([new Uint8Array(32), ethers.utils.keccak256(ethers.utils.toUtf8Bytes('resolver'))]))
  const reverseRegNode = ethers.utils.keccak256(ethers.utils.concat([new Uint8Array(32), ethers.utils.keccak256(ethers.utils.toUtf8Bytes('reverse'))]))
  console.log('resolver node owner:', await ens.owner(resolverNode))
  console.log('reverse registrar node owner:', await ens.owner(reverseRegNode))

  const Multicall = await deploy('Multicall3', { from: deployer })
  context.multicall = await ethers.getContractAt('Multicall3', Multicall.address)

//   console.log('NEXT_PUBLIC_DEPLOYMENT_ADDRESSES=\'' + JSON.stringify({
//     ENSRegistry: context.ens.address,
//     BaseRegistrarImplementation: context.baseRegistrar.address,
//     FIFSRegistrar: context.fifsRegistrar.address,
//     ReverseRegistrar: context.reverseRegistrar.address,
//     MetadataService: context.metadataService.address,
//     NameWrapper: context.nameWrapper.address,
//     ETHRegistrarController: context.registrarController.address,
//     PublicResolver: context.publicResolver.address,
//     UniversalResolver: context.universalResolver.address,
//     Multicall: context.multicall.address
//   }, null, 2) + '\'')
}
