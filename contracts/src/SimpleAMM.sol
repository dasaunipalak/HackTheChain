// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockToken.sol";

// A highly simplified AMM allowing ETH <-> MKT swaps
contract SimpleAMM {
    MockToken public token;
    uint256 public reserveETH;
    uint256 public reserveToken;

    constructor(MockToken _token) payable {
        token = _token;
        reserveETH = msg.value;
    }

    function init(uint256 _tokenAmount) external {
        require(reserveToken == 0, "Already initialized");
        require(token.transferFrom(msg.sender, address(this), _tokenAmount), "Transfer failed");
        reserveToken = _tokenAmount;
    }

    // Spot price: How much ETH is 1 full token (1e18) worth?
    // price = (reserveETH * 1e18) / reserveToken
    function getSpotPrice() external view returns (uint256) {
        require(reserveToken > 0, "No tokens in AMM");
        return (reserveETH * 1e18) / reserveToken;
    }

    // Swap ETH for Tokens (manipulates the price UP)
    function swapETHForTokens() external payable {
        require(msg.value > 0, "Must send ETH");
        
        uint256 ethIn = msg.value;
        
        // k = reserveETH * reserveToken
        // (reserveETH + ethIn) * (reserveToken - tokenOut) = k
        // tokenOut = reserveToken - (k / (reserveETH + ethIn))
        uint256 k = reserveETH * reserveToken;
        uint256 newTokenReserve = k / (reserveETH + ethIn);
        uint256 tokenOut = reserveToken - newTokenReserve;
        
        reserveETH += ethIn;
        reserveToken -= tokenOut;
        
        require(token.transfer(msg.sender, tokenOut), "Transfer failed");
    }
}
