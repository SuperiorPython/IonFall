using UnityEngine;

/// <summary>
/// Repair cards are purchased during Day (like upgrades) but can be USED any time,
/// including mid-night when the dome is under pressure — that's the whole point,
/// per the design doc: a strategic emergency resource, not passive healing.
/// </summary>
public class RepairCardSystem : MonoBehaviour
{
    [Header("Repair Card Settings")]
    [SerializeField] private int cardCost = 20;
    [SerializeField] private float repairAmount = 30f;
    [SerializeField] private KeyCode useCardKey = KeyCode.R;

    [Header("References")]
    [SerializeField] private IonManager ionManager;
    [SerializeField] private DomeHealth domeHealth;
    [SerializeField] private DayNightManager dayNightManager;

    public int CardsOwned { get; private set; }

    private bool isDayPhase;

    private void OnEnable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnDayStarted += HandleDayStarted;
            dayNightManager.OnNightStarted += HandleNightStarted;
        }
    }

    private void OnDisable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnDayStarted -= HandleDayStarted;
            dayNightManager.OnNightStarted -= HandleNightStarted;
        }
    }

    private void HandleDayStarted(int day) => isDayPhase = true;
    private void HandleNightStarted(int night) => isDayPhase = false;

    private void Update()
    {
        // Using a card is allowed in any phase — buying is Day-only, handled in OnGUI.
        if (Input.GetKeyDown(useCardKey))
        {
            UseCard();
        }
    }

    private void BuyCard()
    {
        if (ionManager == null || !ionManager.Spend(cardCost)) return;
        CardsOwned++;
    }

    private void UseCard()
    {
        if (CardsOwned <= 0) return;
        if (domeHealth == null || domeHealth.IsDestroyed) return;

        CardsOwned--;
        domeHealth.Repair(repairAmount);
    }

    // --- Temporary OnGUI panel, same disposable pattern as UpgradeSystem ---
    private void OnGUI()
    {
        GUI.Label(new Rect(300, 20, 260, 24), $"Repair Cards: {CardsOwned}  (Press {useCardKey} to use)");

        if (!isDayPhase) return;

        bool canAfford = ionManager != null && ionManager.CanAfford(cardCost);
        GUI.enabled = canAfford;
        if (GUI.Button(new Rect(300, 50, 220, 30), $"Buy Repair Card — {cardCost} ions"))
        {
            BuyCard();
        }
        GUI.enabled = true;
    }
}
