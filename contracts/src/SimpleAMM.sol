// SPDX-License-Identifier: MIT
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
}