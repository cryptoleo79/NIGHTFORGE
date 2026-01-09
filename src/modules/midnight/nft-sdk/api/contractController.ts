import { type Logger } from 'pino';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import * as Rx from 'rxjs';
import { NFTContract, NFTPrivateStateId, NFTProviders, DeployedNFTContract, emptyState, UserAction, type DerivedState, NFTPrivateState, createPrivateState } from './common-types';
import { SimpleNFT, witnesses } from '@meshsdk/nft-contract';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

export const nftContractInstance: NFTContract = new SimpleNFT.Contract(witnesses);

export interface NFTContractControllerInterface {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Rx.Observable<DerivedState>;
  mint: (uri: string) => Promise<void>;
}

export class NFTContractController implements NFTContractControllerInterface {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Rx.Observable<DerivedState>;
  readonly privateStates$: Rx.Subject<NFTPrivateState>;
  readonly turns$: Rx.Subject<UserAction>;

  private constructor(
    public readonly contractPrivateStateId: typeof NFTPrivateStateId,
    public readonly deployedContract: DeployedNFTContract,
    public readonly providers: NFTProviders,
    private readonly logger: Logger,
  ) {
    const combine = (_acc: DerivedState, value: DerivedState): DerivedState => {
      return {
        ledger: value.ledger,
        privateState: value.privateState,
        turns: value.turns,
      };
    };
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.turns$ = new Rx.Subject<UserAction>();
    this.privateStates$ = new Rx.Subject<NFTPrivateState>();
    this.state$ = Rx.combineLatest(
      [
        providers.publicDataProvider
          .contractStateObservable(this.deployedContractAddress, { type: 'all' })
          .pipe(Rx.map((contractState) => SimpleNFT.ledger(contractState.data as any))),
        Rx.concat(
          Rx.from(
            Rx.defer(() => providers.privateStateProvider.get(contractPrivateStateId) as Promise<NFTPrivateState>),
          ),
          this.privateStates$,
        ),
        Rx.concat(Rx.of<UserAction>({ mint: undefined }), this.turns$),
      ],
      (ledgerState, privateState, userActions) => {
        const result: DerivedState = {
          ledger: ledgerState,
          privateState: privateState,
          turns: userActions,
        };
        return result;
      },
    ).pipe(
      Rx.scan(combine, emptyState),
      Rx.retry({
        delay: 500,
      }),
    );
  }

  async mint(uri: string): Promise<void> {
    this.logger?.info('minting NFT with URI: ' + uri);
    this.turns$.next({ mint: 'minting NFT...' });

    try {
      const txData = await this.deployedContract.callTx.mint(uri);
      this.logger?.trace({
        mint: {
          message: 'NFT minted',
          txHash: txData.public.txHash,
          blockHeight: txData.public.blockHeight,
        },
      });
      this.turns$.next({ mint: undefined });
    } catch (e) {
      this.turns$.next({ mint: undefined });
      throw e;
    }
  }

  static async deploy(
    contractPrivateStateId: typeof NFTPrivateStateId,
    providers: NFTProviders,
    logger: Logger,
  ): Promise<NFTContractController> {
    logger.info({ deployContract: { action: "Deploying NFT contract" } });
    
    const deployedContract = await deployContract(providers as any, {
      privateStateId: contractPrivateStateId,
      contract: nftContractInstance,
      initialPrivateState: await NFTContractController.getPrivateState(contractPrivateStateId, providers.privateStateProvider),
    });

    logger.trace({ contractDeployed: { finalizedDeployTxData: deployedContract.deployTxData.public } });
    return new NFTContractController(contractPrivateStateId, deployedContract, providers, logger);
  }

  static async join(
    contractPrivateStateId: typeof NFTPrivateStateId,
    providers: NFTProviders,
    contractAddress: ContractAddress,
    logger: Logger,
  ): Promise<NFTContractController> {
    logger.info({ joinContract: { action: "Joining NFT contract", contractAddress } });

    const deployedContract = await findDeployedContract(providers as any, {
      contractAddress,
      contract: nftContractInstance,
      privateStateId: contractPrivateStateId,
      initialPrivateState: await NFTContractController.getPrivateState(contractPrivateStateId, providers.privateStateProvider),
    });

    return new NFTContractController(contractPrivateStateId, deployedContract, providers, logger);
  }

  private static async getPrivateState(
    nftPrivateStateId: typeof NFTPrivateStateId,
    privateStateProvider: PrivateStateProvider<typeof NFTPrivateStateId, NFTPrivateState>,
  ): Promise<NFTPrivateState> {
    const existingPrivateState = await privateStateProvider.get(nftPrivateStateId);
    if (existingPrivateState) return existingPrivateState;
    
    // Generate random secret key for NFT ownership
    const secretKey = crypto.getRandomValues(new Uint8Array(32));
    const initialState = createPrivateState(secretKey);
    await privateStateProvider.set(nftPrivateStateId, initialState);
    return initialState;
  }
}
