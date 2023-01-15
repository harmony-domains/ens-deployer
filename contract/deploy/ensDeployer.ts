import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers, network } from 'hardhat'

const ORACLE_UNIT_PRICE = parseInt(process.env.ORACLE_PRICE_PER_SECOND_IN_WEIS || '3')
console.log('ORACLE_UNIT_PRICE', ORACLE_UNIT_PRICE)
const f = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments: { deploy }, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const TLD = process.env.TLD || 'country'
  const OracleDeployer = await deploy('OracleDeployer', { from: deployer, args: [1, [ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE, ORACLE_UNIT_PRICE]] })
  const oracleDeployer = await ethers.getContractAt('OracleDeployer', OracleDeployer.address)
  const priceOracle = await oracleDeployer.oracle()
  console.log('oracleDeployer:', oracleDeployer.address)
  console.log('- priceOracle:', priceOracle)
  console.log('- usdOracle:', await oracleDeployer.usdOracle())
  const ENSUtils = await deploy('ENSUtils', { from: deployer })
  const ENSRegistryDeployer = await deploy('ENSRegistryDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSNFTDeployer = await deploy('ENSNFTDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSControllerDeployer = await deploy('ENSControllerDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSPublicResolverDeployer = await deploy('ENSPublicResolverDeployer', { from: deployer, libraries: { ENSUtils: ENSUtils.address } })
  const ENSDeployer = await deploy('ENSDeployer', {
    from: deployer,
    args: [TLD, priceOracle],
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
  const ensDeployer = await ethers.getContractAt('ENSDeployer', ENSDeployer.address)
  console.log('deployer account', deployer)
  console.log('ENSDeployer deployed to:', ensDeployer.address)
  console.log('- ens deployed to:', await ensDeployer.ens())
  console.log('- fifsRegistrar deployed to:', await ensDeployer.fifsRegistrar())
  console.log('- reverseRegistrar deployed to:', await ensDeployer.reverseRegistrar())
  console.log('- baseRegistrar deployed to:', await ensDeployer.baseRegistrar())

  console.log('- metadataService deployed to:', await ensDeployer.metadataService())
  console.log('- nameWrapper deployed to:', await ensDeployer.nameWrapper())

  console.log('- registrarController deployed to:', await ensDeployer.registrarController())

  console.log('- publicResolver deployed to:', await ensDeployer.publicResolver())

  console.log('- universalResolver deployed to:', await ensDeployer.universalResolver())

  const receipt = await ensDeployer.transferOwner(TLD, deployer).then(tx => tx.wait())
  console.log('tx', receipt.transactionHash)
  const ens = await ethers.getContractAt('ENSRegistry', await ensDeployer.ens())
  console.log('ens owner:', await ens.owner(new Uint8Array(32)))
  const resolverNode = ethers.utils.keccak256(ethers.utils.concat([new Uint8Array(32), ethers.utils.keccak256(ethers.utils.toUtf8Bytes('resolver'))]))
  const reverseRegNode = ethers.utils.keccak256(ethers.utils.concat([new Uint8Array(32), ethers.utils.keccak256(ethers.utils.toUtf8Bytes('reverse'))]))
  console.log('resolver node owner:', await ens.owner(resolverNode))
  console.log('reverse registrar node owner:', await ens.owner(reverseRegNode))

  const Multicall = await deploy('Multicall3', { from: deployer })

  console.log('NEXT_PUBLIC_DEPLOYMENT_ADDRESSES=\'' + JSON.stringify({
    ENSRegistry: await ens.address,
    BaseRegistrarImplementation: await ensDeployer.baseRegistrar(),
    FIFSRegistrar: await ensDeployer.fifsRegistrar(),
    ReverseRegistrar: await ensDeployer.reverseRegistrar(),
    MetadataService: await ensDeployer.metadataService(),
    NameWrapper: await ensDeployer.nameWrapper(),
    ETHRegistrarController: await ensDeployer.registrarController(),
    PublicResolver: await ensDeployer.publicResolver(),
    UniversalResolver: await ensDeployer.universalResolver(),
    Multicall: await Multicall.address
  }) + '\'')

  // Additional tasks not set in ENSDeployer.sol

  // Add some records for local testing (used by go-1ns)
  if (hre.network.name === 'local') {
    console.log(`about to registerDomain in network: ${hre.network.name}`)
    // Note we pass a signer object in and use owner.address in the registration calls
    // We have set up local to use 10 accounts from a mnemonic
    // Logically the 10 accounts represent, deployer, operatorA, operatorB, operatorC, alice, bob, carol, ernie, dora
    const signers = await hre.ethers.getSigners()
    const alice = signers[4]
    const bob = signers[5]
    await registerDomain('test', alice, await ensDeployer.publicResolver(), await ensDeployer.registrarController())
    await registerDomain('testa', alice, await ensDeployer.publicResolver(), await ensDeployer.registrarController())
    await registerDomain('testb', bob, await ensDeployer.publicResolver(), await ensDeployer.registrarController())
  }
}
f.tags = ['ENSDeployer']
export default f

async function registerDomain (domain, owner, resolverAddress, registrarControllerAddress) {
  console.log('in register domain')
  console.log(`owner: ${JSON.stringify(owner)}`)
  console.log(`owner.address: ${JSON.stringify(owner.address)}`)
  const ONE_ETH = ethers.utils.parseEther('1')
  const duration = ethers.BigNumber.from(365 * 24 * 3600)
  const secret = '0x0000000000000000000000000000000000000000000000000000000000000000'
  const callData = []
  const reverseRecord = false
  const fuses = ethers.BigNumber.from(0)
  const wrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
  const registrarController = await ethers.getContractAt('RegistrarController', registrarControllerAddress)
  // const price = await this.priceOracle.price(node, 0, duration)
  // console.log(`price  : ${JSON.stringify(price.toString())}`)
  // console.log(`ONE_ETH: ${JSON.stringify(ONE_ETH.mul(1100).toString())}`)
  const commitment = await registrarController.connect(owner).makeCommitment(
    domain,
    owner.address,
    duration,
    secret,
    resolverAddress,
    callData,
    reverseRecord,
    fuses,
    wrapperExpiry
  )
  let tx = await registrarController.connect(owner).commit(commitment)
  await tx.wait()
  console.log('Commitment Stored')
  tx = await registrarController.connect(owner).register(
    domain,
    owner.address,
    duration,
    secret,
    resolverAddress,
    callData,
    reverseRecord,
    fuses,
    wrapperExpiry,
    {
      value: ONE_ETH.mul(1100)
    }
  )
  await tx.wait()
  console.log(`Registered: ${domain}`)
}
