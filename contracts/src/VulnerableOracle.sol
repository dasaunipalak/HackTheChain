// SPDX-License-Identifier: MIT
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
}