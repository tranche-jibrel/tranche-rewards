# tranche-rewards

Rewards can be distributed in 3 different ways:

1. Dividend Mode: sending an amount of reward tokens directly to tranche token

2. Staking Mode: via IncentiveRewardsFactory, deploying 1 staking contract for each existing tranche token and staking them in a dedicated staking contract. Rewards accrued based on the amount of staken tokens with a rate per second.

3. Unstaken Mode: via IncentiveController, all tranche token holders can be rewarded with a rate per second and based on the tranche token amount on the total tranche token supply.

## How does Incentive Controller contract works (Model)

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
    
Tests on Incentive Rewards Factory is around 95% at the moment

Tests on Incentive Controller contract is around 72% at the moment

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
            <td><code>8.83 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsFactoryStorage</td>
            <td><code>1.08 KiB</code></td>
        </tr>
        <tr>
            <td>IncentivesController</td>
            <td><code>15.70 KiB</code></td>
        </tr>
        <tr>
            <td>IncentivesControllerStorage</td>
            <td><code>1.80 KiB</code></td>
        </tr>
        <tr>
            <td>Markets</td>
            <td><code>11.65 KiB</code></td>
        </tr>
        <tr>
            <td>MarketsStorage</td>
            <td><code>1.32 KiB</code></td>
        </tr>
        <tr>
            <td>MarketsHelpers</td>
            <td><code>3.58 KiB</code></td>
        </tr>
    </tbody>
  </table>
