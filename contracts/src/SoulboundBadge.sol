// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title SoulboundBadge
 * @dev Non-transferable ERC-1155 token to prove on-chain exploit completion.
 */
contract SoulboundBadge is ERC1155 {
    address public immutable factory;

    constructor() ERC1155("https://api.hackthechain.xyz/metadata/{id}.json") {
        factory = msg.sender;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Not authorized: Only Factory");
        _;
    }

    function mintBadge(address player, uint256 levelId) external onlyFactory {
        _mint(player, levelId, 1, "");
    }

    // Override the transfer hook to make the badges non-transferable (Soulbound)
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        require(from == address(0) || to == address(0), "Soulbound: Badges cannot be transferred");
        super._update(from, to, ids, values);
    }
}