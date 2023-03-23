import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import { dns } from '../lib'
import namehash from 'eth-ens-namehash'
import { LengthBasedPriceOracle, PublicResolver, Tweet, BaseRegistrarImplementation, ENSRegistry, TLDNameWrapper } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

// Get the Tweet contract
const PUBLIC_RESOLVER = process.env.PUBLIC_RESOLVER as string
// const REGISTRAR_CONTROLLER = process.env.REGISTRAR_CONTROLLER as string
const PRICE_ORACLE = process.env.PRICE_ORACLE as string
const TWEET_ADDRESS = process.env.TWEET_CONTRACT as string
// const REGISTRAR = process.env.REGISTRAR as string
// const REGISTRY = process.env.REGISTRY as string || '0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B'
const TLD_NAME_WRAPPER = process.env.TLD_NAME_WRAPPER as string || '0xB7aa4c318000BB9bD16108F81C40D02E48af1C42'
const BASE_RENTAL_PRICE_ETH = process.env.BASE_RENTAL_PRICE_ETH as string
const DURATION_DAYS = process.env.DURATION_DAYS as string

// Will leave the DNS update functions as well
async function registerDomain (domain: string, owner: SignerWithAddress, url: string, ip: string) {
  const duration = ethers.BigNumber.from(Number(DURATION_DAYS) * 24 * 3600)
  const secret = new Uint8Array(32).fill(0)
  // const callData = []
  // const reverseRecord = false
  // const fuses = ethers.BigNumber.from(0)
  // const wrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
  // const registrarController: RegistrarController = await ethers.getContractAt('RegistrarController', REGISTRAR_CONTROLLER)
  const tweet: Tweet = await ethers.getContractAt('Tweet', TWEET_ADDRESS)
  // const registrar: BaseRegistrarImplementation = await ethers.getContractAt('BaseRegistrarImplementation', REGISTRAR)
  // const registry: ENSRegistry = await ethers.getContractAt('ENSRegistry', REGISTRY)
  const tldNameWrapper: TLDNameWrapper = await ethers.getContractAt('TLDNameWrapper', TLD_NAME_WRAPPER)
  const priceOracle: LengthBasedPriceOracle = await ethers.getContractAt('LengthBasedPriceOracle', PRICE_ORACLE)
  const price = await priceOracle.price(domain, 0, duration)
  const baseRentalPrice = ethers.utils.parseEther(BASE_RENTAL_PRICE_ETH).toString()
  const priceTotal = price.base.add(price.premium).add(baseRentalPrice)
  console.log(`registering domain: ${domain}`)
  console.log(`price          : ${JSON.stringify(price.toString())}`)
  console.log(`baseRentalprice: ${JSON.stringify(baseRentalPrice.toString())}`)
  console.log(`price.base     : ${ethers.utils.formatEther(price.base)}`)
  console.log(`price.premium  : ${ethers.utils.formatEther(price.premium)}`)
  console.log(`tweet.base_rental : ${ethers.utils.formatEther(baseRentalPrice)}`)
  console.log(`price.total    : ${ethers.utils.formatEther(priceTotal)}`)
  const commitment = await tweet.connect(owner).makeCommitment(
    domain,
    owner.address,
    secret
  )
  let txr = await (await tweet.connect(owner).commit(commitment)).wait()
  console.log('Commitment Stored', txr.transactionHash)
  txr = await (await tweet.connect(owner).register(
    domain,
    owner.address,
    url,
    secret,
    {
      value: priceTotal
    }
  )).wait()
  console.log(`Registered: ${domain}`, txr.transactionHash)

  const publicResolver: PublicResolver = await ethers.getContractAt('PublicResolver', PUBLIC_RESOLVER)
  const TLD = process.env.TLD || 'country'
  const node = namehash.hash(domain + '.' + TLD)
  const FQDN = domain + '.' + TLD + '.'
  console.log(`domain: ${domain}`)
  console.log(`FQDN: ${FQDN}`)
  console.log(`node: ${node}`)
  // check the owner
  // console.log('++++++ OWNER    ++++++')
  // console.log(`owner.address                                  : ${owner.address}`)
  // console.log(`TLDNameWrapper.address                         : ${TLD_NAME_WRAPPER}`)
  // console.log(`${domain} owner via registrar                : ${await registrar.ownerOf(ethers.utils.id(domain))}`)
  // console.log(`${domain} owner via registry using node      : ${await registry.owner(node)}`)
  // console.log(`${domain} owner via TLDNameWrapper using node: ${await tldNameWrapper.ownerOf(node)}`)
  // console.log(`${domain} URI   via TLDNameWrapper using node: ${await tldNameWrapper.uri(node)}`)
  // console.log('++++++ OWNER end ++++++')
  const [initARecFQDN] = dns.encodeARecord({ name: FQDN, ipAddress: ip })
  const aNameFQDN = 'a.' + FQDN
  const [initARecAFQDN] = dns.encodeARecord({ name: aNameFQDN, ipAddress: ip })
  // Set CNAME Record for one.domain
  const oneNameFQDN = 'one.' + FQDN
  const [initCnameRecOneFQDN] = dns.encodeCNAMERecord({ name: oneNameFQDN, cname: 'harmony.one' })
  // Set Initial DNS entries
  let initRec
  // set all records for test domain and less for other domains
  if (domain === 'test') {
    const DefaultSoa = {
      primary: 'ns1.countrydns.xyz.',
      admin: 'hostmaster.test.country',
      serial: 2018061501,
      refresh: 15620,
      retry: 1800,
      expiration: 1814400,
      minimum: 14400
    }
    const DefaultSrv = {
      priority: 10,
      weight: 10,
      port: 8080,
      target: 'srv.test.country.'
    }
    const [initSoaRec] = dns.encodeSOARecord({ name: FQDN, rvalue: DefaultSoa })
    const [initSrvRec] = dns.encodeSRVRecord({ name: 'srv.' + FQDN, rvalue: DefaultSrv })
    const [initCnameRecWWW] = dns.encodeCNAMERecord({ name: 'www.' + FQDN, cname: 'test.country' })
    const [initDnameRec] = dns.encodeDNAMERecord({ name: 'docs.' + FQDN, dname: 'docs.harmony.one' })
    const [initNsRec] = dns.encodeNSRecord({ name: FQDN, nsname: 'ns3.hiddenstate.xyz' })
    const [initTxtRec] = dns.encodeTXTRecord({ name: FQDN, text: 'magic' })
    initRec = '0x' +
        initARecFQDN +
        initARecAFQDN +
        initCnameRecOneFQDN +
        initCnameRecWWW +
        initDnameRec +
        initNsRec +
        initSoaRec +
        initSrvRec +
        initTxtRec
  } else {
    initRec = '0x' + initARecFQDN + initARecAFQDN + initCnameRecOneFQDN
  }
  txr = await (await publicResolver.connect(owner).setDNSRecords(node, initRec)).wait()
  console.log(`setDNSRecords ${txr.transactionHash}`)
  // Set initial zonehash
  txr = await (await publicResolver.connect(owner).setZonehash(
    node,
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  )).wait()
  console.log(`Created records for: ${domain + '.' + TLD} and a.${FQDN} same ip address: ${ip}; tx ${txr.transactionHash}`)

  // NFT and Metadata Information
  /*

    function ownerOf(uint256 id) public view override(ERC1155Fuse, INameWrapper) returns (address owner) {
    function getData(uint256 id) public view override(ERC1155Fuse, INameWrapper) returns (address, uint32, uint64) {
    function uri(uint256 tokenId) public view override returns (string memory) {
  */
  console.log(`a.country uri tldNameWrapper: ${await tldNameWrapper.uri(namehash.hash('a.country'))}`)
  console.log(`a.country uri               : ${ethers.utils.id(namehash.hash('a.country'))}  `)
  console.log(`a.country tid               : ${ethers.BigNumber.from(namehash.hash('a.country'))}  `)
  console.log(`testtesttest110.country uri : ${ethers.utils.id(namehash.hash('testtesttest110.country'))}  `)
  console.log(`testtesttest110.country tid : ${ethers.BigNumber.from(namehash.hash('testtesttest110.country'))}  `)
  const [owner1155, fuses, fuseExpiry] = await tldNameWrapper.getData(node)
  console.log('======================NFT FROM TLDWRAPPER ====================')
  console.log(`owner                              : ${owner.address}`)
  console.log(`domain                             : ${domain}`)
  console.log(`ethers.utils.id(domain)            : ${ethers.utils.id(domain)}`)
  console.log(`nodeURL                            : ${domain + '.' + TLD} `)
  console.log(`node:  namehash.hash(nodeURL)      : ${node}`)
  console.log(`ethers.utils.id(node)              : ${(ethers.utils.id(node))}`)
  console.log(`tokenId ethers.BigNumber.from(node): ${ethers.BigNumber.from(node)}`)
  console.log(`node from TokenId                  : ${ethers.BigNumber.from(node).toHexString()}`)
  console.log(`owner                              : ${await tldNameWrapper.ownerOf(node)}`)
  console.log(`URI                                : ${await tldNameWrapper.uri(node)}`)
  console.log(`1155owner                          : ${owner1155}`)
  console.log(`fuses                              : ${fuses}`)
  console.log(`fuseExpiry                         : ${fuseExpiry}`)
  console.log('======================NFT FROM TLDWRAPPER ====================')
}

const func = async function (hre: HardhatRuntimeEnvironment) {
  // Add some records for local testing (used by go-1ns, a CoreDNS plugin)
  if (hre.network.name !== 'local' && hre.network.name !== 'hardhat') {
    throw new Error('Should only deploy sample Tweet registration in hardhat or local network')
  }
  console.log(`about to registerDomain using Tweet in network: ${hre.network.name}`)
  // The 10 signer accounts represent: deployer, operatorA, operatorB, operatorC, alice, bob, carol, ernie, dora
  const signers = await ethers.getSigners()
  const alice = signers[4]
  const bob = signers[5]

  // Register Domains
  await registerDomain('a', alice, 'tweet.polymorpher.country', '148.0.0.1')
  // node
  const nodeURL = 'a.country'
  const node = namehash.hash(nodeURL) // 0x97cb60f41aa9c0aedfc85b76e4ffc8cb2b845b001fe1b19b78f73b3b734e1fa7
  const tokenID = ethers.BigNumber.from(node) // 68658579238907467122893703214502809166139884805022338151742896602255318720423
  const metadataPrefix = 'https://storage.googleapis.com/radical-domain-metadata/erc1155/'
  const metadataURL = metadataPrefix + node // https://storage.googleapis.com/radical-domain-metadata/erc1155/0x97cb60f41aa9c0aedfc85b76e4ffc8cb2b845b001fe1b19b78f73b3b734e1fa7

  // getting the nodeurl from the tokenId
  const tokenIDString = '68658579238907467122893703214502809166139884805022338151742896602255318720423'
  const tokenIDBigNumber = ethers.BigNumber.from(tokenIDString)
  const nodeFromTokenId = tokenIDBigNumber.toHexString()// 0x97cb60f41aa9c0aedfc85b76e4ffc8cb2b845b001fe1b19b78f73b3b734e1fa7

  console.log('=============== Sample data for a.country ========================')
  console.log(`nodeURL        : ${nodeURL}`)
  console.log(`node           : ${node}`)
  console.log(`tokenID        : ${tokenID}`)
  console.log(`metadataPrefix : ${metadataPrefix}`)
  console.log(`metadataURL    : ${metadataURL}`)
  console.log(`nodeFromTokenId: ${nodeFromTokenId}`)
  console.log('=============== End Sample data for a.country ====================')

  await registerDomain('polymorpher', alice, 'tweet.polymorpher.country', '148.0.0.1')
  await registerDomain('tweettesta', alice, 'tweet.tweettesta.country', '138.0.0.2')
  await registerDomain('tweettestb', bob, 'tweet.tweettestb.country', '138.0.0.3')
  await registerDomain('tweettestlongdomain', bob, 'tweet.tweettestlongdomain.country', '138.0.0.1')
}

func.tags = ['ENSSampleTweetDNS']
func.dependencies = ['ENSDeployer', 'DC']
export default func
