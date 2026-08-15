// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CTFFactory} from "../src/CTFFactory.sol";

contract DeployCTF is Script {
    function run() external {
        // Require the backend trusted signer for Level 3 to be configured
        address level3TrustedSigner = vm.envAddress("LEVEL3_TRUSTED_SIGNER");
        require(level3TrustedSigner != address(0), "Invalid trusted signer");

        // Pulls the private key from your .env file
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Starts recording transactions to broadcast to the network
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the Factory (which automatically deploys the Badge contract)
        CTFFactory factory = new CTFFactory(level3TrustedSigner);
        
        console.log("CTFFactory deployed at:", address(factory));
        console.log("SoulboundBadge deployed at:", address(factory.badgeContract()));

        vm.stopBroadcast();
    }
}