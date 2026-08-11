// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Level4_SignatureReplay {
    using ECDSA for bytes32;

    address public trustedSigner;

    constructor(address _trustedSigner) payable {
        require(msg.value == 0.05 ether, "Requires exactly 0.05 ETH to setup");
        trustedSigner = _trustedSigner;
    }

    function withdraw(address recipient, uint256 amount, bytes memory signature) external {
        // Construct the message hash bounded to this specific contract
        bytes32 messageHash = keccak256(abi.encodePacked(address(this), recipient, amount));
        
        // Convert to Ethereum Signed Message Hash
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        // Recover the signer
        address recoveredSigner = ECDSA.recover(ethSignedMessageHash, signature);
        
        // Verify the signer is trusted
        require(recoveredSigner == trustedSigner, "Invalid signature");

        // VULNERABILITY:
        // The signature is never marked as used and there is no nonce.
        // Therefore, a valid authorization can be replayed multiple times.
        // A valid signature proves authorization, but it does NOT automatically mean the authorization can only be used once.

        // Transfer the authorized amount
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function isComplete() external view returns (bool) {
        // Challenge is complete when the vault is fully drained
        return address(this).balance == 0;
    }
}
