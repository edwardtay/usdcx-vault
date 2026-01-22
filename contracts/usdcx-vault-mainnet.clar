;; USDCx Vault Mainnet - Real USDCx Savings Vault
;; Earn yield on Circle USDCx
;; Secured by Bitcoin via Stacks
;;
;; Future: Integrate with Zest Protocol for automated yield

;; ============================================
;; TRAIT IMPORTS - Use local trait for compilation
;; On mainnet, this resolves to the deployed trait
;; ============================================

(use-trait ft-trait .sip-010-trait.sip-010-trait)

;; ============================================
;; CONSTANTS
;; ============================================

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u100))
(define-constant ERR_INSUFFICIENT_BALANCE (err u101))
(define-constant ERR_INVALID_AMOUNT (err u102))
(define-constant ERR_VAULT_PAUSED (err u103))
(define-constant ERR_ZERO_SHARES (err u105))
(define-constant ERR_SLIPPAGE (err u107))

;; USDCx has 6 decimals
(define-constant DECIMALS u1000000)
(define-constant INSTANT_FEE_BPS u50) ;; 0.5% fee on instant withdrawal

;; ============================================
;; DATA VARIABLES
;; ============================================

(define-data-var vault-paused bool false)
(define-data-var total-shares uint u0)
(define-data-var total-assets uint u0)
(define-data-var last-harvest-block uint block-height)
(define-data-var total-yield-earned uint u0)
(define-data-var annual-yield-rate uint u500) ;; 5% APY in basis points

;; ============================================
;; DATA MAPS
;; ============================================

(define-map user-shares principal uint)
(define-map user-deposit-block principal uint)

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (get-vault-info)
  (ok {
    total-shares: (var-get total-shares),
    total-assets: (var-get total-assets),
    total-yield-earned: (var-get total-yield-earned),
    annual-yield-rate: (var-get annual-yield-rate),
    is-paused: (var-get vault-paused),
    last-harvest-block: (var-get last-harvest-block)
  })
)

(define-read-only (get-user-position (user principal))
  (let (
    (shares (get-user-shares user))
    (balance (get-user-balance user))
    (deposit-block (default-to u0 (map-get? user-deposit-block user)))
  )
    {
      shares: shares,
      balance: balance,
      deposit-block: deposit-block,
      blocks-since-deposit: (- block-height deposit-block)
    }
  )
)

(define-read-only (get-user-shares (user principal))
  (default-to u0 (map-get? user-shares user))
)

(define-read-only (get-user-balance (user principal))
  (let (
    (shares (get-user-shares user))
  )
    (shares-to-assets shares)
  )
)

(define-read-only (get-share-price)
  (let (
    (total-sh (var-get total-shares))
    (total-as (var-get total-assets))
  )
    (if (is-eq total-sh u0)
      DECIMALS ;; 1:1 when empty
      (/ (* total-as DECIMALS) total-sh)
    )
  )
)

(define-read-only (get-annual-yield-rate)
  (var-get annual-yield-rate)
)

;; ============================================
;; PRIVATE FUNCTIONS
;; ============================================

(define-private (shares-to-assets (shares uint))
  (let (
    (total-sh (var-get total-shares))
    (total-as (var-get total-assets))
  )
    (if (is-eq total-sh u0)
      shares
      (/ (* shares total-as) total-sh)
    )
  )
)

(define-private (assets-to-shares (assets uint))
  (let (
    (total-sh (var-get total-shares))
    (total-as (var-get total-assets))
  )
    (if (is-eq total-as u0)
      assets
      (/ (* assets total-sh) total-as)
    )
  )
)

;; ============================================
;; PUBLIC FUNCTIONS
;; ============================================

;; Deposit USDCx into the vault
(define-public (deposit (usdcx-token <ft-trait>) (amount uint) (min-shares uint))
  (let (
    (sender tx-sender)
    (shares-to-mint (assets-to-shares amount))
    (current-shares (get-user-shares sender))
  )
    ;; Validations
    (asserts! (not (var-get vault-paused)) ERR_VAULT_PAUSED)
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (> shares-to-mint u0) ERR_ZERO_SHARES)
    (asserts! (>= shares-to-mint min-shares) ERR_SLIPPAGE)

    ;; Transfer USDCx from user to vault
    (try! (contract-call? usdcx-token transfer amount sender (as-contract tx-sender) none))

    ;; Update state
    (var-set total-shares (+ (var-get total-shares) shares-to-mint))
    (var-set total-assets (+ (var-get total-assets) amount))
    (map-set user-shares sender (+ current-shares shares-to-mint))
    (map-set user-deposit-block sender block-height)

    ;; Emit event
    (print {
      event: "deposit",
      user: sender,
      amount: amount,
      shares-minted: shares-to-mint,
      total-shares: (var-get total-shares),
      total-assets: (var-get total-assets)
    })

    (ok shares-to-mint)
  )
)

;; Withdraw USDCx from the vault (instant with small fee)
(define-public (withdraw (usdcx-token <ft-trait>) (shares uint) (min-amount uint))
  (let (
    (sender tx-sender)
    (current-shares (get-user-shares sender))
    (gross-amount (shares-to-assets shares))
    (fee (/ (* gross-amount INSTANT_FEE_BPS) u10000))
    (net-amount (- gross-amount fee))
  )
    ;; Validations
    (asserts! (not (var-get vault-paused)) ERR_VAULT_PAUSED)
    (asserts! (> shares u0) ERR_INVALID_AMOUNT)
    (asserts! (>= current-shares shares) ERR_INSUFFICIENT_BALANCE)
    (asserts! (>= net-amount min-amount) ERR_SLIPPAGE)

    ;; Update state first
    (var-set total-shares (- (var-get total-shares) shares))
    (var-set total-assets (- (var-get total-assets) gross-amount))
    (map-set user-shares sender (- current-shares shares))

    ;; Transfer USDCx to user (minus fee)
    (try! (as-contract (contract-call? usdcx-token transfer net-amount tx-sender sender none)))

    ;; Fee stays in vault, benefiting remaining depositors
    (var-set total-assets (+ (var-get total-assets) fee))

    ;; Emit event
    (print {
      event: "withdraw",
      user: sender,
      shares-burned: shares,
      gross-amount: gross-amount,
      fee: fee,
      net-amount: net-amount
    })

    (ok net-amount)
  )
)

;; ============================================
;; ADMIN FUNCTIONS - Yield Management
;; ============================================

;; Add yield to the vault (called after Zest harvest or manual yield)
(define-public (add-yield (yield-amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)

    ;; Add yield to total assets (increases share price)
    (var-set total-assets (+ (var-get total-assets) yield-amount))
    (var-set total-yield-earned (+ (var-get total-yield-earned) yield-amount))
    (var-set last-harvest-block block-height)

    (print {
      event: "yield-added",
      yield-amount: yield-amount,
      total-yield-earned: (var-get total-yield-earned),
      new-share-price: (get-share-price)
    })

    (ok yield-amount)
  )
)

;; Update the advertised APY
(define-public (set-annual-yield-rate (rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (var-set annual-yield-rate rate)
    (ok rate)
  )
)

;; Pause/unpause vault
(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (var-set vault-paused paused)
    (ok paused)
  )
)

;; Emergency withdraw all from vault (admin only)
(define-public (emergency-withdraw (usdcx-token <ft-trait>) (recipient principal))
  (let (
    (balance (var-get total-assets))
  )
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (try! (as-contract (contract-call? usdcx-token transfer balance tx-sender recipient none)))
    (var-set total-assets u0)
    (ok balance)
  )
)
