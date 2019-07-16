pragma solidity ^0.5.0;

import { PullPaymentA } from "../interfaces/PullPaymentA.sol";

/**
 * @dev Used to enforce success checking in `.call.value`.
 */
contract RejectRecipient {

    constructor() public {
    }

    function withdrawPaymentFrom(PullPaymentA where) public returns (bool success) {
        return where.withdrawPayment();
    }

    function() external {
        revert();
    }
}