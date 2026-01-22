;; USDCx Vault for Testnet - Works with Real USDCx Token
;; Earn yield on USDC-backed stablecoins with Bitcoin security
;;
;; Note: Uses local trait for compilation
;; On testnet deployment, this resolves correctly

;; ============================================
;; TRAIT IMPORTS - Use local trait for compilation
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
(define-constant ERR_WITHDRAWAL_LOCKED (err u104))
(define-constant ERR_ZERO_SHARES (err u105))
(define-constant ERR_SLIPPAGE (err u107))

;; USDCx has 6 decimals
(define-constant DECIMALS u1000000)
(define-constant WITHDRAWAL_COOLDOWN u144) ;; ~24 hours in blocks
(define-constant INSTANT_FEE_BPS u100) ;; 1% = 100 basis points

;; Default APY (5% = 500 basis points)
(define-constant DEFAULT_APY_BPS u500)

;; ============================================
;; DATA VARIABLES
;; ============================================

(define-data-var vault-paused bool false)
(define-data-var total-shares uint u0)
(define-data-var total-assets uint u0)
(define-data-var last-harvest-block uint block-height)
(define-data-var total-yield-earned uint u0)
(define-data-var annual-yield-rate uint DEFAULT_APY_BPS)

;; ============================================
;; DATA MAPS
;; ============================================

(define-map user-shares principal uint)
(define-map user-deposit-block principal uint)
(define-map withdrawal-requests
    principal
    { shares: uint, request-block: uint, processed: bool })

;; ============================================
;; READ-ONLY FUNCTIONS
;; ============================================

(define-read-only (get-vault-info)
  (ok {
    total-shares: (var-get total-shares),
    total-assets: (var-get total-assets),
    accumulated-yield: (var-get total-yield-earned),
    annual-yield-rate: (var-get annual-yield-rate),
    is-paused: (var-get vault-paused),
    last-yield-update: (var-get last-harvest-block)
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
      DECIMALS ;; 1:1 initial price
      (/ (* total-as DECIMALS) total-sh)
    )
  )
)

(define-read-only (shares-to-assets (shares uint))
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

(define-read-only (assets-to-shares (assets uint))
  (let (
    (total-sh (var-get total-shares))
    (total-as (var-get total-assets))
  )
    (if (or (is-eq total-sh u0) (is-eq total-as u0))
      assets
      (/ (* assets total-sh) total-as)
    )
  )
)

(define-read-only (preview-deposit (assets uint))
  (assets-to-shares assets)
)

(define-read-only (preview-withdraw (shares uint))
  (shares-to-assets shares)
)

(define-read-only (preview-instant-withdraw (shares uint))
  (let (
    (gross-amount (shares-to-assets shares))
    (fee (/ (* gross-amount INSTANT_FEE_BPS) u10000))
  )
    {
      gross-amount: gross-amount,
      fee: fee,
      net-amount: (- gross-amount fee)
    }
  )
)

(define-read-only (get-withdrawal-request (user principal))
  (map-get? withdrawal-requests user)
)

(define-read-only (can-process-withdrawal (user principal))
  (match (map-get? withdrawal-requests user)
    request
      (and
        (not (get processed request))
        (>= (- block-height (get request-block request)) WITHDRAWAL_COOLDOWN)
      )
    false
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

    (print {
      event: "deposit",
      user: sender,
      amount: amount,
      shares: shares-to-mint,
      share-price: (get-share-price),
      block: block-height
    })
    (ok shares-to-mint)
  )
)

;; Request withdrawal from the vault (starts cooldown)
(define-public (request-withdrawal (shares uint))
  (let (
    (sender tx-sender)
    (user-sh (get-user-shares sender))
    (estimated-amount (shares-to-assets shares))
  )
    ;; Validations
    (asserts! (not (var-get vault-paused)) ERR_VAULT_PAUSED)
    (asserts! (> shares u0) ERR_INVALID_AMOUNT)
    (asserts! (>= user-sh shares) ERR_INSUFFICIENT_BALANCE)

    ;; Create/update withdrawal request
    (map-set withdrawal-requests sender {
      shares: shares,
      request-block: block-height,
      processed: false
    })

    (print {
      event: "withdrawal-requested",
      user: sender,
      shares: shares,
      estimated-amount: estimated-amount,
      unlock-block: (+ block-height WITHDRAWAL_COOLDOWN)
    })
    (ok { shares: shares, unlock-block: (+ block-height WITHDRAWAL_COOLDOWN) })
  )
)

;; Process withdrawal after cooldown period
(define-public (process-withdrawal (usdcx-token <ft-trait>))
  (let (
    (sender tx-sender)
    (request (unwrap! (get-withdrawal-request sender) ERR_INVALID_AMOUNT))
    (shares (get shares request))
    (request-block (get request-block request))
    (withdrawal-amount (shares-to-assets shares))
    (user-sh (get-user-shares sender))
  )
    ;; Validations
    (asserts! (not (var-get vault-paused)) ERR_VAULT_PAUSED)
    (asserts! (not (get processed request)) ERR_INVALID_AMOUNT)
    (asserts! (>= (- block-height request-block) WITHDRAWAL_COOLDOWN) ERR_WITHDRAWAL_LOCKED)
    (asserts! (>= user-sh shares) ERR_INSUFFICIENT_BALANCE)

    ;; Update state first (checks-effects-interactions pattern)
    (var-set total-shares (- (var-get total-shares) shares))
    (var-set total-assets (- (var-get total-assets) withdrawal-amount))
    (map-set user-shares sender (- user-sh shares))
    (map-set withdrawal-requests sender {
      shares: u0,
      request-block: u0,
      processed: true
    })

    ;; Transfer USDCx from vault to user
    (try! (as-contract (contract-call? usdcx-token transfer withdrawal-amount tx-sender sender none)))

    (print {
      event: "withdrawal-processed",
      user: sender,
      shares: shares,
      amount: withdrawal-amount,
      block: block-height
    })
    (ok withdrawal-amount)
  )
)

;; Cancel pending withdrawal request
(define-public (cancel-withdrawal)
  (let (
    (sender tx-sender)
    (request (unwrap! (get-withdrawal-request sender) ERR_INVALID_AMOUNT))
  )
    (asserts! (not (get processed request)) ERR_INVALID_AMOUNT)

    (map-delete withdrawal-requests sender)

    (print { event: "withdrawal-cancelled", user: sender })
    (ok true)
  )
)

;; Instant withdrawal with fee (no cooldown)
(define-public (instant-withdraw (usdcx-token <ft-trait>) (shares uint) (min-amount uint))
  (let (
    (sender tx-sender)
    (user-sh (get-user-shares sender))
    (gross-amount (shares-to-assets shares))
    (fee (/ (* gross-amount INSTANT_FEE_BPS) u10000))
    (net-amount (- gross-amount fee))
  )
    ;; Validations
    (asserts! (not (var-get vault-paused)) ERR_VAULT_PAUSED)
    (asserts! (> shares u0) ERR_INVALID_AMOUNT)
    (asserts! (>= user-sh shares) ERR_INSUFFICIENT_BALANCE)
    (asserts! (>= net-amount min-amount) ERR_SLIPPAGE)

    ;; Update state (fee stays in vault, boosting yield for remaining depositors)
    (var-set total-shares (- (var-get total-shares) shares))
    (var-set total-assets (- (var-get total-assets) net-amount))
    (map-set user-shares sender (- user-sh shares))

    ;; Transfer USDCx from vault to user
    (try! (as-contract (contract-call? usdcx-token transfer net-amount tx-sender sender none)))

    (print {
      event: "instant-withdrawal",
      user: sender,
      shares: shares,
      gross-amount: gross-amount,
      fee: fee,
      net-amount: net-amount
    })
    (ok net-amount)
  )
)

;; ============================================
;; ADMIN FUNCTIONS
;; ============================================

;; Add yield manually (simulates strategy yield for demo)
(define-public (add-yield (usdcx-token <ft-trait>) (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)

    ;; Transfer yield into vault
    (try! (contract-call? usdcx-token transfer amount tx-sender (as-contract tx-sender) none))

    (var-set total-assets (+ (var-get total-assets) amount))
    (var-set total-yield-earned (+ (var-get total-yield-earned) amount))
    (var-set last-harvest-block block-height)

    (print {
      event: "yield-added",
      amount: amount,
      new-total-assets: (var-get total-assets),
      new-share-price: (get-share-price)
    })
    (ok true)
  )
)

;; Simulate yield accrual (for demo - increases share price)
(define-public (simulate-yield-accrual (yield-amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (> yield-amount u0) ERR_INVALID_AMOUNT)

    ;; Directly increase total assets (simulates yield without token transfer)
    (var-set total-assets (+ (var-get total-assets) yield-amount))
    (var-set total-yield-earned (+ (var-get total-yield-earned) yield-amount))
    (var-set last-harvest-block block-height)

    (print {
      event: "yield-simulated",
      amount: yield-amount,
      new-total-assets: (var-get total-assets),
      new-share-price: (get-share-price)
    })
    (ok true)
  )
)

;; Set APY rate (for display purposes)
(define-public (set-annual-yield-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (<= new-rate u2000) ERR_INVALID_AMOUNT) ;; Max 20%
    (var-set annual-yield-rate new-rate)
    (ok true)
  )
)

;; Pause/unpause vault (emergency)
(define-public (set-vault-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (var-set vault-paused paused)

    (print { event: "vault-pause-updated", paused: paused })
    (ok true)
  )
)

;; Emergency withdraw all assets (only when paused)
(define-public (emergency-withdraw (usdcx-token <ft-trait>))
  (let (
    (sender tx-sender)
    (user-sh (get-user-shares sender))
    (withdrawal-amount (shares-to-assets user-sh))
  )
    (asserts! (var-get vault-paused) ERR_VAULT_PAUSED)
    (asserts! (> user-sh u0) ERR_INSUFFICIENT_BALANCE)

    ;; Update state
    (var-set total-shares (- (var-get total-shares) user-sh))
    (var-set total-assets (- (var-get total-assets) withdrawal-amount))
    (map-set user-shares sender u0)
    (map-delete withdrawal-requests sender)

    ;; Transfer
    (try! (as-contract (contract-call? usdcx-token transfer withdrawal-amount tx-sender sender none)))

    (print { event: "emergency-withdrawal", user: sender, amount: withdrawal-amount })
    (ok withdrawal-amount)
  )
)
