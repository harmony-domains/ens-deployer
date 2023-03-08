//SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;
import "@openzeppelin/contracts/utils/Strings.sol";

contract TLDMetadataService {
    string private baseUri;

    constructor(string memory _metaDataUri) {
        baseUri = _metaDataUri;
    }

    function uri(uint256 tokenId) public view returns (string memory) {
        return string.concat(baseUri, "/" ,Strings.toString(tokenId));
    }
}
