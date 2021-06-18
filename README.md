# tranche-rewards

## how does Slicetroller contract works

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

    `truffle test ./test/Rewards2.test.js`   

Solidity Coverage (no ganache required):

    `truffle run coverage --network development`   
    
     

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
            <td>Markets</td>
            <td><code>11.54 KiB</code></td>
        </tr>
        <tr>
            <td>MarketsStorage</td>
            <td><code>1.32 KiB</code></td>
        </tr>
        <tr>
            <td>RewardsDistribution</td>
            <td><code>13.07 KiB</code></td>
        </tr>
        <tr>
            <td>RewardsDistributionStorage</td>
            <td><code>1.28 KiB</code></td>
        </tr>
        <tr>
            <td>StakingRewards</td>
            <td><code>5.26 KiB</code></td>
        </tr>
        <tr>
            <td>StakingRewardsStorage</td>
            <td><code>1.14 KiB</code></td>
        </tr>
        <tr>
            <td>StakingRewardsFactory</td>
            <td><code>9.45 KiB</code></td>
        </tr>
        <tr>
            <td>StakingRewardsFactoryStorage</td>
            <td><code>1.8 KiB</code></td>
        </tr>
    </tbody>
  </table>
