
import * as web3 from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new web3.PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
const METADATA_PROGRAM_ID =
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'

const METADATA_PROGRAM_ID_PUBLIC_KEY = new web3.PublicKey(METADATA_PROGRAM_ID)

function _utf8ArrayToNFTType(
  array
) {
  const str = new TextDecoder().decode(array)
  const query = 'https://'
  const startIndex = str.indexOf(query)

  // metaplex standard nfts live in arweave, see link below
  // https://github.com/metaplex-foundation/metaplex/blob/81023eb3e52c31b605e1dcf2eb1e7425153600cd/js/packages/web/src/contexts/meta/processMetaData.ts#L29
  const isMetaplex = str.includes('arweave')

  // star atlas nfts live in https://galaxy.staratlas.com/nfts/...
  const isStarAtlas = str.includes('staratlas')

  const isInvalid = (!isMetaplex && !isStarAtlas) || startIndex === -1
  if (isInvalid) {
    return null
  }

  const suffix = isMetaplex ? '/' : '/nfts/'
  const suffixIndex = str.indexOf(suffix, startIndex + query.length)
  if (suffixIndex === -1) {
    return null
  }

  const hashLength = isMetaplex ? 43 : 44
  const endIndex = suffixIndex + suffix.length + hashLength

  const url = str.substring(startIndex, endIndex)
  return {
    url
  }
}

var connection = new web3.Connection(
    web3.clusterApiUrl('mainnet-beta'),
    'confirmed',
);

const getAllCollectibles = async (wallets)=> {
    
    const tokenAccountsByOwnerAddress = await Promise.all(
        wallets.map(async address =>
            connection.getParsedTokenAccountsByOwner(
                new web3.PublicKey(address),
                {
                    programId: TOKEN_PROGRAM_ID
                }
            )
        )
    )
    const potentialNFTsByOwnerAddress = tokenAccountsByOwnerAddress
    .map(ta => ta.value)
    // value is an array of parsed token info
    .map((value, i) => {
    const mintAddresses = value
        .map(v => ({
        mint: v.account.data.parsed.info.mint,
        tokenAmount: v.account.data.parsed.info.tokenAmount
        }))
        .filter(({ tokenAmount }) => {
        // Filter out the token if we don't have any balance
        const ownsNFT = tokenAmount.amount !== '0'
        // Filter out the tokens that don't have 0 decimal places.
        // NFTs really should have 0
        const hasNoDecimals = tokenAmount.decimals === 0
        return ownsNFT && hasNoDecimals
        })
        .map(({ mint }) => mint)
    return { mintAddresses }
    })
    const nfts = await Promise.all(
        potentialNFTsByOwnerAddress.map(async ({ mintAddresses }) => {
            const programAddresses = await Promise.all(
                mintAddresses.map(
                    async mintAddress =>
                    (
                        await web3.PublicKey.findProgramAddress(
                        [
                            Buffer.from('metadata'),
                            METADATA_PROGRAM_ID_PUBLIC_KEY.toBytes(),
                            new web3.PublicKey(mintAddress).toBytes()
                        ],
                        METADATA_PROGRAM_ID_PUBLIC_KEY
                        )
                    )[0]
                )
            )

            const accountInfos = await connection.getMultipleAccountsInfo(programAddresses)
            const nonNullInfos = accountInfos?.filter(Boolean) ?? []

            const metadataUrls = nonNullInfos
            .map(x => _utf8ArrayToNFTType(x.data))
            .filter(Boolean)

            const results = await Promise.all(
                metadataUrls.map(async item =>
                    fetch(item.url)
                    .then(res => res.json())
                    .catch(() => null)
                )
            )

            const metadatas = results.map((metadata, i) => ({
                metadata,
                type: metadataUrls[i].type
            }))
            return metadatas.filter(r => !!r.metadata)
        })
    )
    console.log("nfts", nfts);
    return nfts;
}

const wallets = ["upmAVLcqPya1WKUW6ecGVe3gBtHSJo1i6zQmhjM6BaZ", "8jTSV9N8r3TZ1w9wAizeNx133Dmp4e1h4f3Pyp9daZyC"]
getAllCollectibles(wallets)
