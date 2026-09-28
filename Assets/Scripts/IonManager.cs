using System;
using UnityEngine;

/// <summary>
/// Tracks the player's ion currency. Other systems (IonMiner, UpgradeSystem, UI)
/// should call Add()/Spend() and subscribe to OnIonsChanged rather than reading
/// a public field directly, so nothing can bypass the Spend() validation.
/// </summary>
public class IonManager : MonoBehaviour
{
    [SerializeField] private int startingIons = 0;

    public int CurrentIons { get; private set; }

    public event Action<int> OnIonsChanged;

    private void Awake()
    {
        CurrentIons = startingIons;
    }

    public void Add(int amount)
    {
        if (amount <= 0) return;

        CurrentIons += amount;
        OnIonsChanged?.Invoke(CurrentIons);
    }

    /// <summary>Returns true if the spend succeeded (i.e. enough ions were available).</summary>
    public bool Spend(int amount)
    {
        if (amount <= 0) return false;
        if (CurrentIons < amount) return false;

        CurrentIons -= amount;
        OnIonsChanged?.Invoke(CurrentIons);
        return true;
    }

    public bool CanAfford(int amount) => CurrentIons >= amount;
}
