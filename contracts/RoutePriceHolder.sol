pragma solidity ^0.5.0;

import './Owned.sol';
import './TollBoothHolder.sol';
import './interfaces/RoutePriceHolderI.sol';

contract RoutePriceHolder is Owned, TollBoothHolder, RoutePriceHolderI {

    mapping(address => mapping(address => uint)) private priceMap;

    constructor() public {}

    function setRoutePrice(address entryBooth, address exitBooth, uint priceWeis)
        public
        fromOwner
        returns(bool success)
    {
        require(isTollBooth(entryBooth), "Entry booth is not registered.");
        require(isTollBooth(exitBooth), "Exit booth is not registered.");
        require(entryBooth != exitBooth, "Entry and exit booths cannot be the same.");
        require(entryBooth != address(0), "Entry booth cannot be 0x0.");
        require(exitBooth != address(0), "Exit booth cannot be 0x0.");
        require(priceMap[entryBooth][exitBooth] != priceWeis, "Price already set to desired value.");

        priceMap[entryBooth][exitBooth] = priceWeis;

        emit LogRoutePriceSet(msg.sender, entryBooth, exitBooth, priceWeis);

        success = true;
    }

    function getRoutePrice(address entryBooth, address exitBooth)
        view
        public
        returns(uint priceWeis)
    {
        priceWeis = priceMap[entryBooth][exitBooth];

        if ((!isTollBooth(entryBooth)) || (!isTollBooth(exitBooth))){
            priceWeis = 0;
        }
    }
}
