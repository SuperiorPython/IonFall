using UnityEngine;

/// <summary>
/// Repair cards are purchased during Day (via DayScreenUI) but can be USED any time,
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

    public int CardsOwned { get; private set; }
    public int CardCost => cardCost;

    private void Update()
    {
        // Using a card is allowed in any phase, including mid-night.
        if (Input.GetKeyDown(useCardKey))
        {
            UseCard();
        }
    }

    public void BuyCard()
    {
        if (ionManager == null || !ionManager.Spend(cardCost)) return;
        CardsOwned++;
    }

    private void UseCard()
    {
        if (CardsOwned <= 0)
        {
            Debug.Log("Repair card use failed: no cards owned. Buy one during the Day screen first.");
            return;
        }
        if (domeHealth == null)
        {
            Debug.LogWarning("Repair card use failed: RepairCardSystem has no DomeHealth assigned in the Inspector.");
            return;
        }
        if (domeHealth.IsDestroyed)
        {
            Debug.Log("Repair card use failed: dome is already destroyed.");
            return;
        }

        CardsOwned--;
        domeHealth.Repair(repairAmount);
        Debug.Log($"Repair card used — healed {repairAmount}. Cards remaining: {CardsOwned}");
    }

    // Always-visible reminder that a card can be used, regardless of phase or shop screen.
    private void OnGUI()
    {
        GUI.Label(new Rect(300, 20, 260, 24), $"Repair Cards: {CardsOwned}  (Press {useCardKey} to use)");
    }
}
