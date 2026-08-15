export const LEVEL2_TARGET_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./VulnerableOracle.sol";

contract Level2_OracleManipulation {
    IERC20 public immutable mkt;
    IERC20 public immutable trace;
    VulnerableOracle public immutable oracle;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public borrowed;

    constructor(
        IERC20 _mkt,
        IERC20 _trace,
        VulnerableOracle _oracle
    ) {
        mkt = _mkt;
        trace = _trace;
        oracle = _oracle;
    }

    // Player deposits MKT as collateral.
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        require(
            mkt.transferFrom(msg.sender, address(this), amount),
            "MKT transfer failed"
        );

        collateral[msg.sender] += amount;
    }

    // Player borrows TRC using MKT as collateral.
    //
    // The vulnerability is that the collateral value
    // comes directly from the manipulatable oracle.
    function borrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        uint256 price = oracle.getPrice();

        // MKT amount × TRC/MKT price = collateral value in TRC.
        uint256 collateralValue =
            (collateral[msg.sender] * price) / 1e18;

        // 75% loan-to-value.
        uint256 maxBorrow =
            (collateralValue * 75) / 100;

        require(
            borrowed[msg.sender] + amount <= maxBorrow,
            "Insufficient collateral"
        );

        require(
            trace.balanceOf(address(this)) >= amount,
            "Insufficient vault liquidity"
        );

        borrowed[msg.sender] += amount;

        require(
            trace.transfer(msg.sender, amount),
            "TRC transfer failed"
        );
    }

    // Level is complete when the entire TRC vault is drained.
    function isComplete() external view returns (bool) {
        return trace.balanceOf(address(this)) == 0;
    }
}`;

export const VULNERABLE_ORACLE_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimpleAMM.sol";

contract VulnerableOracle {
    SimpleAMM public immutable amm;

    constructor(SimpleAMM _amm) {
        amm = _amm;
    }

    // Returns the current spot price of 1 MKT in TRC.
    function getPrice() external view returns (uint256) {
        return amm.getSpotPrice();
    }
}`;

export const SIMPLE_AMM_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleAMM {
    IERC20 public immutable mkt;
    IERC20 public immutable trace;

    uint256 public reserveMKT;
    uint256 public reserveTRACE;

    constructor(IERC20 _mkt, IERC20 _trace) {
        mkt = _mkt;
        trace = _trace;
    }

    // Factory provides the initial liquidity.
    function init(
        uint256 amountMKT,
        uint256 amountTRACE
    ) external {
        require(
            reserveMKT == 0 && reserveTRACE == 0,
            "Already initialized"
        );

        require(
            mkt.transferFrom(msg.sender, address(this), amountMKT),
            "MKT transfer failed"
        );

        require(
            trace.transferFrom(msg.sender, address(this), amountTRACE),
            "TRACE transfer failed"
        );

        reserveMKT = amountMKT;
        reserveTRACE = amountTRACE;
    }

    // Price of 1 MKT in TRC.
    // Returned with 18 decimal precision.
    function getSpotPrice() external view returns (uint256) {
        require(reserveMKT > 0, "No MKT liquidity");

        return (reserveTRACE * 1e18) / reserveMKT;
    }

    // Player spends TRC to buy MKT.
    //
    // This is the important part of the oracle attack:
    //
    // TRC reserve increases
    // MKT reserve decreases
    // MKT/TRC price increases
    function swapTRACEForMKT(uint256 traceIn) external {
        require(traceIn > 0, "Must send TRC");

        require(
            trace.transferFrom(msg.sender, address(this), traceIn),
            "TRACE transfer failed"
        );

        uint256 k = reserveMKT * reserveTRACE;

        uint256 newTRACEReserve = reserveTRACE + traceIn;

        uint256 newMKTReserve = k / newTRACEReserve;

        uint256 mktOut = reserveMKT - newMKTReserve;

        reserveTRACE = newTRACEReserve;
        reserveMKT = newMKTReserve;

        require(
            mkt.transfer(msg.sender, mktOut),
            "MKT transfer failed"
        );
    }

    // Optional reverse swap.
    function swapMKTForTRACE(uint256 mktIn) external {
        require(mktIn > 0, "Must send MKT");

        require(
            mkt.transferFrom(msg.sender, address(this), mktIn),
            "MKT transfer failed"
        );

        uint256 k = reserveMKT * reserveTRACE;

        uint256 newMKTReserve = reserveMKT + mktIn;

        uint256 newTRACEReserve = k / newMKTReserve;

        uint256 traceOut = reserveTRACE - newTRACEReserve;

        reserveMKT = newMKTReserve;
        reserveTRACE = newTRACEReserve;

        require(
            trace.transfer(msg.sender, traceOut),
            "TRACE transfer failed"
        );
    }
}`;

export function stripComments(code: string): string {
    return code
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
        .replace(/^\s*[\r\n]/gm, '\n') // Remove empty lines created by comment removal (optional)
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Consolidate multiple empty lines to max 2
        .trim();
}
