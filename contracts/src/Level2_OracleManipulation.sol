// SPDX-License-Identifier: MIT
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
}