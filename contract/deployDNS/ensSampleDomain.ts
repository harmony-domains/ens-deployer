import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers, network } from 'hardhat'
import { BufferConsumer, BufferWriter, DNSRecord } from 'dns-js'
import { PublicResolver } from '../typechain'
const namehash = require('eth-ens-namehash')

console.log('Just Sample Domain only works for mainnetpk')
const f = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === 'mainnetpk') {
    const signers = await hre.ethers.getSigners()
    const alice = signers[0]
    console.log(`alice.address: ${alice.address}`)
    await registerDomain('testlongdomain', alice, '34.120.199.241', process.env.PUBLIC_RESOLVER, process.env.REGISTRAR_CONTROLLER)
  }
}
f.tags = ['ENSSampleDomain']
export default f

async function registerDomain (domain, owner, ip, resolverAddress, registrarControllerAddress) {
  const ONE_ETH = ethers.utils.parseEther('1')
  const duration = ethers.BigNumber.from(28 * 24 * 3600)
  const secret = '0x0000000000000000000000000000000000000000000000000000000000000000'
  const callData = []
  const reverseRecord = false
  const fuses = ethers.BigNumber.from(0)
  const wrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
  //   const priceOracle = await ethers.getContractAt('LengthBasedPriceOracle', process.env.PRICE_ORACLE)
  //   const price = await priceOracle.price(domain, 0, duration)
  //   console.log(`registering domain: ${domain}`)
  //   console.log(`price          : ${JSON.stringify(price.toString())}`)
  //   console.log(`price.base     : ${ethers.utils.formatEther(price.base)}`)
  //   console.log(`price.premium  : ${ethers.utils.formatEther(price.premium)}`)
  const registrarController = await ethers.getContractAt('RegistrarController', registrarControllerAddress)
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
      value: ONE_ETH.mul(3)
    //   value: price.base.add(price.premium)
    }
  )
  await tx.wait()
  console.log(`Registered: ${domain}`)

  // Also set a default A record
  const publicResolver = await ethers.getContractAt('PublicResolver', resolverAddress)
  const TLD = process.env.TLD || 'country'
  const node = namehash.hash(domain + '.' + TLD)
  console.log('==================')
  const FQDN = domain + '.' + TLD + '.'
  const initRecDomainFQDN = encodeARecord(FQDN, ip)
  const initRec = '0x' + initRecDomainFQDN
  // Set Initial DNS entries
  console.log(`node: ${node}`)
  console.log(`initRec: ${initRec}`)
  tx = await publicResolver.connect(owner).setDNSRecords(node, initRec)
  await tx.wait()
  // Set intial zonehash
  tx = await publicResolver.connect(owner).setZonehash(
    node,
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  )
  await tx.wait()
  console.log(`Created records for: ${domain + '.' + TLD} ip address: ${ip}`)
  console.log('==================')
}

export function encodeARecord (recName, recAddress) {
  // Sample Mapping
  // a.test.country. 3600 IN A 1.2.3.4
  /*
      name: a.test.country.
      type: A
      class: IN
      ttl: 3600
      address: 1.2.3.4
    */
  // returns 0161047465737407636f756e747279000001000100000e10000401020304

  // a empty address is used to remove existing records
  let rec = {}
  rec = {
    name: recName,
    type: DNSRecord.Type.A,
    class: DNSRecord.Class.IN,
    ttl: 3600,
    address: recAddress
  }
  const bw = new BufferWriter()
  const b = DNSRecord.write(bw, rec).dump()
  console.log(`b.json: ${JSON.stringify(b)}`)
  console.log(`recordText: ${b.toString('hex')}`)
  return b.toString('hex')
}
