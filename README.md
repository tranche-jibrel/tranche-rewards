# tranche-rewards

Rewards can be distributed in 4 different ways:

1. Dividend Mode: sending an amount of reward tokens directly to tranche token (calculations has to be performed offchain)

2. Dividend Distribution Mode: via RewardsDistribution contract, like Dividend Mode, but using a contract to send tokens to tranche tokens distributed based on single market TVLs and distributing rewards to trache token holders in a single place

3. Staking Mode: via IncentiveRewardsFactory contract, deploying 1 staking contract for each existing tranche token and staking them in a dedicated staking contract. Rewards accrued based on the amount of staken tokens with a rate per second.

4. Unstaken Mode: via IncentiveController contract, all tranche token holders can be rewarded with a rate per second and based on the tranche token amount on the total tranche token supply.

All modes can be used or not, depending on the way you would like to distribute rewards.

Underlying prices for markets can be directly set by the owner, or read from chainlink price feeds. 

## What is the model contracts work when distributing rewards based on markets TVLs

This Model can be present in all mode or not, can be set in a contract or move to the backend. Please refer to Model.sol for a pure implementation of this model, or Markets.sol for Staking Mode, or MarketHelper.sol for IncentivesController and RewardsDistribution mode. 

Data: 

    totalTVL = total value locked (TVL) inside tranche A & B
    extProtRet = external protocol return
    trARet = tranche A return
    trATVL = tranche A TVL
    trBTVL = tranche B TVL
    balFactor = slice balance factor between tranche A & B (50% means the same amount of slice tokens per tranche when tranches have the same return) 
    dailySliceAmount = amount of slice tokens per day


1. tranche B Return:

    `(totalTVL * (1 + extProtRet) - trATVL * (1 + trARet) - trBTVL) / trBTVL = trancheBReturn`

2. difference between external protocol return and tranche B return:

    `extProtRet - trancheBReturn = DeltaAPY`

3. ratio between DeltaAPY and extProtRet:

    `DeltaAPY / extProtRet = DeltaAPYPercentage`

4. add balanceFactor to DeltaAPYPercentage:

    `DeltaAPYPercentage + balFactor = trBPercentage`

5. multiply trBPercentage by dailySliceAmount:

    `trBPercentage * dailySliceAmount = trBSliceRewards`

6. subtract trBSliceRewards to dailySliceAmount: 

    `dailySliceAmount - trBSliceRewards = trASliceRewards`

All in one formula:

    (((extProtRet-(totalTVL*(1+extProtRet)-trATVL*(1+trARet)-trBTVL)/trBTVL)/extProtRet)+balFactor)*dailySliceAmount

## Tests

Ways to test contracts:

All tests (ganache required: npx ganache-cli --deterministic -l 12000000), gas reporter included:

    `truffle test`   

1 test only (ganache required: npx ganache-cli --deterministic -l 12000000), gas reporter included:

    `truffle test ./test/IncentiveRewards.test.js`   

Solidity Coverage (no ganache required):

    `truffle run coverage --network development --file="<filename>"`   

### Test Coverage

Every distribution mode requires different contract(s) to be deployed, that's why you can find 3 different files in migration and in test folders. The easiest way to test all contracts is to deploy 1 mode only per session and launch the related test file(s)
    
Tests on Rewards Distribution is around 91% at the moment

Tests on Incentive Rewards Factory is around 95% at the moment

Tests on Incentive Controller contract is around 97% at the moment

## Contracts Size (main contracts, no interfaces, no test contracts)
Limit is 24 KiB for single contract
<table>
    <thead>
      <tr>
        <th>Contract</th>
        <th>Size</th>
      </tr>
    </thead>
    <tbody>
        <tr>
            <td>IncentiveRewards</td>
            <td><code>4.18 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsStorage</td>
            <td><code>1.04 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsFactory</td>
            <td><code>9.50 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsFactoryStorage</td>
            <td><code>1.11 KiB</code></td>
        </tr>
        <tr>
            <td>IncentivesController</td>
            <td><code>16.82 KiB</code></td>
        </tr>
        <tr>
            <td>IncentivesControllerStorage</td>
            <td><code>1.82 KiB</code></td>
        </tr>
        <tr>
            <td>Markets</td>
            <td><code>13.00 KiB</code></td>
        </tr>
        <tr>
            <td>MarketsStorage</td>
            <td><code>1.40 KiB</code></td>
        </tr>
        <tr>
            <td>MarketsHelper</td>
            <td><code>4.16 KiB</code></td>
        </tr>
        <tr>
            <td>PriceHelper</td>
            <td><code>3.73 KiB</code></td>
        </tr>
        <tr>
            <td>PriceHelperStorage</td>
            <td><code>0.95 KiB</code></td>
        </tr>
        <tr>
            <td>RewardsDistribution</td>
            <td><code>13.32 KiB</code></td>
        </tr>
        <tr>
            <td>RewardsDistributionStorage</td>
            <td><code>1.36 KiB</code></td>
        </tr>
    </tbody>
  </table>
