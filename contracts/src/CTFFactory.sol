// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoulboundBadge.sol";
import "./Level1_Reentrancy.sol";

contract CTFFactory {
    SoulboundBadge public badgeContract;
    
    mapping(uint256 => mapping(address => address)) public levelInstances;
    mapping(uint256 => mapping(address => bool)) public isSolved;

    event InstanceCreated(address indexed player, uint256 indexed levelId, address instance);
    event LevelSolved(address indexed player, uint256 indexed levelId);

    constructor() {
        badgeContract = new SoulboundBadge();
    }

    function deployLevel1() external payable returns (address) {
        require(msg.value == 0.01 ether, "Must fund the level instance with 0.01 ETH");
        require(levelInstances[1][msg.sender] == address(0), "Instance already deployed");

        bytes32 salt = keccak256(abi.encodePacked(msg.sender, uint256(1)));
        Level1_Reentrancy instance = new Level1_Reentrancy{salt: salt, value: msg.value}();
        
        levelInstances[1][msg.sender] = address(instance);
        
        emit InstanceCreated(msg.sender, 1, address(instance));
        return address(instance);
    }

    function validateLevel1() external {
        address instanceAddress = levelInstances[1][msg.sender];
        require(instanceAddress != address(0), "Instance not deployed");
        require(!isSolved[1][msg.sender], "Level already solved");

        Level1_Reentrancy instance = Level1_Reentrancy(instanceAddress);
        
        require(instance.isComplete(), "Hack incomplete: Contract not drained");

        isSolved[1][msg.sender] = true;
        badgeContract.mintBadge(msg.sender, 1);
        
        emit LevelSolved(msg.sender, 1);
    }
}