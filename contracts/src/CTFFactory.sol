// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TRACE.sol";
import "./MKT.sol";
import "./SimpleAMM.sol";
import "./VulnerableOracle.sol";
import "./SoulboundBadge.sol";
import "./Level1_Reentrancy.sol";
import "./Level2_OracleManipulation.sol";
import "./Level3_SignatureReplay.sol";

contract CTFFactory {
    TRACE public trace;
    SoulboundBadge public badgeContract;
    address public level3TrustedSigner;

    mapping(uint256 => mapping(address => address)) public levelInstances;
    mapping(uint256 => mapping(address => bool)) public isSolved;

    // Prevent players from receiving Level 1 starter TRC more than once.
    mapping(address => bool) public level1StarterClaimed;

    event InstanceCreated(
        address indexed player,
        uint256 indexed levelId,
        address instance
    );

    event LevelSolved(
        address indexed player,
        uint256 indexed levelId
    );

    constructor(address _level3TrustedSigner) {
        trace = new TRACE();
        badgeContract = new SoulboundBadge();
        level3TrustedSigner = _level3TrustedSigner;
    }

    // ==========================================
    // LEVEL 1: REENTRANCY
    // ==========================================

    function deployLevel1() external returns (address) {
        require(
            levelInstances[1][msg.sender] == address(0),
            "Instance already deployed"
        );

        Level1_Reentrancy instance =
            new Level1_Reentrancy(address(trace));

        // Fund Level 1 vault with 100 TRC.
        trace.mint(
            address(instance),
            100 ether
        );

        // Give the player 10 TRC to fund their attacker contract.
        if (!level1StarterClaimed[msg.sender]) {
            level1StarterClaimed[msg.sender] = true;

            trace.mint(
                msg.sender,
                10 ether
            );
        }

        levelInstances[1][msg.sender] =
            address(instance);

        emit InstanceCreated(
            msg.sender,
            1,
            address(instance)
        );

        return address(instance);
    }

    function validateLevel1() external {
        address instanceAddress =
            levelInstances[1][msg.sender];

        require(
            instanceAddress != address(0),
            "Instance not deployed"
        );

        require(
            !isSolved[1][msg.sender],
            "Level already solved"
        );

        Level1_Reentrancy instance =
            Level1_Reentrancy(instanceAddress);

        require(
            instance.isComplete(),
            "Hack incomplete: Contract not drained"
        );

        isSolved[1][msg.sender] = true;

        badgeContract.mintBadge(
            msg.sender,
            1
        );

        emit LevelSolved(
            msg.sender,
            1
        );
    }

    // ==========================================
    // LEVEL 2: ORACLE MANIPULATION
    // ==========================================

    function deployLevel2() external returns (address) {
        require(
            isSolved[1][msg.sender],
            "Must solve Level 1 first"
        );

        require(
            levelInstances[2][msg.sender] == address(0),
            "Instance already deployed"
        );

        // --------------------------------------
        // 1. Deploy MKT
        // --------------------------------------

        MKT mkt = new MKT();

        // --------------------------------------
        // 2. Deploy MKT/TRC AMM
        // --------------------------------------

        SimpleAMM amm = new SimpleAMM(
            IERC20(address(mkt)),
            IERC20(address(trace))
        );

        // --------------------------------------
        // 3. Deploy vulnerable oracle
        // --------------------------------------

        VulnerableOracle oracle =
            new VulnerableOracle(amm);

        // --------------------------------------
        // 4. Deploy Level 2 vault
        // --------------------------------------

        Level2_OracleManipulation instance =
            new Level2_OracleManipulation(
                IERC20(address(mkt)),
                IERC20(address(trace)),
                oracle
            );

        // --------------------------------------
        // 5. Give factory tokens for AMM setup
        // --------------------------------------

        mkt.mint(
            address(this),
            10 ether
        );

        trace.mint(
            address(this),
            10 ether
        );

        // --------------------------------------
        // 6. Initialize AMM
        //
        // AMM:
        // 10 MKT
        // 10 TRC
        //
        // Initial price:
        // 1 MKT = 10 TRC
        // --------------------------------------

        mkt.approve(
            address(amm),
            10 ether
        );

        trace.approve(
            address(amm),
            10 ether
        );

        amm.init(
            10 ether,
            10 ether
        );

        // --------------------------------------
        // 7. Fund Level 2 vault
        //
        // Vault:
        // 100 TRC
        // --------------------------------------

        trace.mint(
            address(instance),
            100 ether
        );

        // --------------------------------------
        // 8. Give player Level 2 assets
        //
        // 10 MKT = collateral
        // 40 TRC = attack capital
        // --------------------------------------

        mkt.mint(
            msg.sender,
            10 ether
        );

        trace.mint(
            msg.sender,
            40 ether
        );

        // --------------------------------------
        // Save instance
        // --------------------------------------

        levelInstances[2][msg.sender] =
            address(instance);

        emit InstanceCreated(
            msg.sender,
            2,
            address(instance)
        );

        return address(instance);
    }

    function validateLevel2() external {
        address instanceAddress =
            levelInstances[2][msg.sender];

        require(
            instanceAddress != address(0),
            "Instance not deployed"
        );

        require(
            !isSolved[2][msg.sender],
            "Level already solved"
        );

        Level2_OracleManipulation instance =
            Level2_OracleManipulation(
                instanceAddress
            );

        require(
            instance.isComplete(),
            "Hack incomplete: Vault not drained"
        );

        isSolved[2][msg.sender] = true;

        badgeContract.mintBadge(
            msg.sender,
            2
        );

        emit LevelSolved(
            msg.sender,
            2
        );
    }

    // ==========================================
    // LEVEL 3: SIGNATURE REPLAY
    // ==========================================

    function deployLevel3() external returns (address) {
        require(
            isSolved[2][msg.sender],
            "Must solve Level 2 first"
        );

        require(
            levelInstances[3][msg.sender] == address(0),
            "Instance already deployed"
        );

        Level3_SignatureReplay instance =
            new Level3_SignatureReplay(
                address(trace),
                level3TrustedSigner
            );

        // Fund Level 3 vault with 100 TRC.
        trace.mint(
            address(instance),
            100 ether
        );

        levelInstances[3][msg.sender] =
            address(instance);

        emit InstanceCreated(
            msg.sender,
            3,
            address(instance)
        );

        return address(instance);
    }

    function validateLevel3() external {
        address instanceAddress =
            levelInstances[3][msg.sender];

        require(
            instanceAddress != address(0),
            "Instance not deployed"
        );

        require(
            !isSolved[3][msg.sender],
            "Level already solved"
        );

        Level3_SignatureReplay instance =
            Level3_SignatureReplay(instanceAddress);

        require(
            instance.isComplete(),
            "Hack incomplete"
        );

        isSolved[3][msg.sender] = true;

        badgeContract.mintBadge(
            msg.sender,
            3
        );

        emit LevelSolved(
            msg.sender,
            3
        );
    }
}