// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SoulboundBadge.sol";
import "./Level1_AccessControl.sol";
import "./Level2_Reentrancy.sol";
import "./Level3_OracleManipulation.sol";
import "./Level4_SignatureReplay.sol";
import "./Level5_Delegatecall.sol";

contract CTFFactory {
    SoulboundBadge public badgeContract;
    address public level4TrustedSigner;
    
    mapping(uint256 => mapping(address => address)) public levelInstances;
    mapping(uint256 => mapping(address => bool)) public isSolved;

    event InstanceCreated(address indexed player, uint256 indexed levelId, address instance);
    event LevelSolved(address indexed player, uint256 indexed levelId);

    constructor(address _level4TrustedSigner) {
        badgeContract = new SoulboundBadge();
        level4TrustedSigner = _level4TrustedSigner;
    }

    // ==========================================
    // LEVEL 1: ACCESS CONTROL
    // ==========================================
    function deployLevel1() external payable returns (address) {
        require(msg.value == 0.01 ether, "Must fund the level instance with 0.01 ETH");
        require(levelInstances[1][msg.sender] == address(0), "Instance already deployed");

        Level1_AccessControl instance = new Level1_AccessControl{value: msg.value}();
        
        levelInstances[1][msg.sender] = address(instance);
        
        emit InstanceCreated(msg.sender, 1, address(instance));
        return address(instance);
    }

    function validateLevel1() external {
        address instanceAddress = levelInstances[1][msg.sender];
        require(instanceAddress != address(0), "Instance not deployed");
        require(!isSolved[1][msg.sender], "Level already solved");

        Level1_AccessControl instance = Level1_AccessControl(instanceAddress);
        
        require(instance.isComplete(), "Hack incomplete: Contract not drained");

        isSolved[1][msg.sender] = true;
        badgeContract.mintBadge(msg.sender, 1);
        
        emit LevelSolved(msg.sender, 1);
    }

    // ==========================================
    // LEVEL 2: REENTRANCY
    // ==========================================
    function deployLevel2() external payable returns (address) {
        require(isSolved[1][msg.sender], "Must solve Level 1 first");
        require(msg.value == 0.01 ether, "Must fund the level instance with 0.01 ETH");
        require(levelInstances[2][msg.sender] == address(0), "Instance already deployed");

        bytes32 salt = keccak256(abi.encodePacked(msg.sender, uint256(2)));
        Level2_Reentrancy instance = new Level2_Reentrancy{salt: salt, value: msg.value}();
        
        levelInstances[2][msg.sender] = address(instance);
        
        emit InstanceCreated(msg.sender, 2, address(instance));
        return address(instance);
    }

    function validateLevel2() external {
        address instanceAddress = levelInstances[2][msg.sender];
        require(instanceAddress != address(0), "Instance not deployed");
        require(!isSolved[2][msg.sender], "Level already solved");

        Level2_Reentrancy instance = Level2_Reentrancy(instanceAddress);
        
        require(instance.isComplete(), "Hack incomplete: Contract not drained");

        isSolved[2][msg.sender] = true;
        badgeContract.mintBadge(msg.sender, 2);
        
        emit LevelSolved(msg.sender, 2);
    }

    // ==========================================
    // LEVEL 3: ORACLE MANIPULATION
    // ==========================================
    function deployLevel3() external payable returns (address) {
        require(isSolved[2][msg.sender], "Must solve Level 2 first");
        require(msg.value == 0.11 ether, "Must fund the level instance with 0.11 ETH");
        require(levelInstances[3][msg.sender] == address(0), "Instance already deployed");

        Level3_OracleManipulation instance = new Level3_OracleManipulation{value: msg.value}();
        
        levelInstances[3][msg.sender] = address(instance);
        
        emit InstanceCreated(msg.sender, 3, address(instance));
        return address(instance);
    }

    function validateLevel3() external {
        address instanceAddress = levelInstances[3][msg.sender];
        require(instanceAddress != address(0), "Instance not deployed");
        require(!isSolved[3][msg.sender], "Level already solved");

        Level3_OracleManipulation instance = Level3_OracleManipulation(instanceAddress);
        
        require(instance.isComplete(), "Hack incomplete: Contract not drained");

        isSolved[3][msg.sender] = true;
        badgeContract.mintBadge(msg.sender, 3);
        
        emit LevelSolved(msg.sender, 3);
    }

    // ==========================================
    // LEVEL 4: SIGNATURE REPLAY
    // ==========================================
    function deployLevel4() external payable returns (address) {
        require(isSolved[3][msg.sender], "Must solve Level 3 first");
        require(msg.value == 0.05 ether, "Must fund the level instance with 0.05 ETH");
        require(levelInstances[4][msg.sender] == address(0), "Instance already deployed");

        Level4_SignatureReplay instance = new Level4_SignatureReplay{value: msg.value}(level4TrustedSigner);
        
        levelInstances[4][msg.sender] = address(instance);
        
        emit InstanceCreated(msg.sender, 4, address(instance));
        return address(instance);
    }

    function validateLevel4() external {
        address instanceAddress = levelInstances[4][msg.sender];
        require(instanceAddress != address(0), "Instance not deployed");
        require(!isSolved[4][msg.sender], "Level already solved");

        Level4_SignatureReplay instance = Level4_SignatureReplay(instanceAddress);
        
        require(instance.isComplete(), "Hack incomplete: Contract not drained");

        isSolved[4][msg.sender] = true;
        badgeContract.mintBadge(msg.sender, 4);
        
        emit LevelSolved(msg.sender, 4);
    }

    // ==========================================
    // LEVEL 5: DELEGATECALL / STORAGE COLLISION
    // ==========================================
    function deployLevel5() external payable returns (address) {
        require(isSolved[4][msg.sender], "Must solve Level 4 first");
        require(msg.value == 0.05 ether, "Must fund the level instance with 0.05 ETH");
        require(levelInstances[5][msg.sender] == address(0), "Instance already deployed");

        Level5_Implementation implementation = new Level5_Implementation();
        Level5_ProxyVault proxy = new Level5_ProxyVault{value: msg.value}(address(implementation));
        
        levelInstances[5][msg.sender] = address(proxy);
        
        emit InstanceCreated(msg.sender, 5, address(proxy));
        return address(proxy);
    }

    function validateLevel5() external {
        address instanceAddress = levelInstances[5][msg.sender];
        require(instanceAddress != address(0), "Instance not deployed");
        require(!isSolved[5][msg.sender], "Level already solved");

        Level5_ProxyVault instance = Level5_ProxyVault(payable(instanceAddress));
        
        require(instance.isComplete(), "Hack incomplete: Contract not drained");

        isSolved[5][msg.sender] = true;
        badgeContract.mintBadge(msg.sender, 5);
        
        emit LevelSolved(msg.sender, 5);
    }
}