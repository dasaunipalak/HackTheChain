export const LEVEL3_TARGET_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Level3_SignatureReplay {
    using ECDSA for bytes32;

    IERC20 public immutable trace;

    address public trustedSigner;

    constructor(
        address _trace,
        address _trustedSigner
    ) {
        trace = IERC20(_trace);
        trustedSigner = _trustedSigner;
    }

    function withdraw(
        address recipient,
        uint256 amount,
        bytes memory signature
    ) external {
        // The signed message is tied to:
        // 1. This vault
        // 2. The recipient
        // 3. The withdrawal amount
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(this),
                recipient,
                amount
            )
        );

        // Convert it to the standard Ethereum signed-message hash.
        bytes32 ethSignedMessageHash =
            MessageHashUtils.toEthSignedMessageHash(
                messageHash
            );

        // Recover whoever created the signature.
        address recoveredSigner =
            ECDSA.recover(
                ethSignedMessageHash,
                signature
            );

        // Only the trusted signer can authorize withdrawals.
        require(
            recoveredSigner == trustedSigner,
            "Invalid signature"
        );

        // VULNERABILITY:
        // The signature is never marked as used.
        //
        // Therefore, the exact same valid signature
        // can be submitted repeatedly.
        //
        // Example:
        // Signature says:
        // "Player can withdraw 10 TRC"
        //
        // Player can call this function with that
        // same signature again and again.

        require(
            trace.balanceOf(address(this)) >= amount,
            "Insufficient vault balance"
        );

        require(
            trace.transfer(recipient, amount),
            "TRC transfer failed"
        );
    }

    function isComplete() external view returns (bool) {
        return trace.balanceOf(address(this)) == 0;
    }
}`;
