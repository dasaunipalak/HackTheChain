// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SimpleAMM.sol";

contract VulnerableOracle {
    SimpleAMM public amm;

    constructor(SimpleAMM _amm) {
        amm = _amm;
    }

    // Returns price of 1 token in ETH
    function getPrice() external view returns (uint256) {
        return amm.getSpotPrice();
    }
}
