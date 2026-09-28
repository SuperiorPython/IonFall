using System;
using UnityEngine;

/// <summary>
/// Handles firing projectiles and the turret's heat/overheat mechanic.
/// Attach to the same object as Turret.cs (TurretPivot).
/// </summary>
[RequireComponent(typeof(Turret))]
public class TurretShoot : MonoBehaviour
{
    [Header("Firing")]
    [SerializeField] private GameObject projectilePrefab;
    [SerializeField] private Transform firePoint; // empty child at the barrel tip
    [SerializeField] private float fireRate = 6f; // shots per second

    [Header("UI Guard")]
    [SerializeField] private UpgradeSystem upgradeSystem; // optional — prevents firing when clicking shop buttons

    [Header("Heat")]
    [SerializeField] private float maxHeat = 100f;
    [SerializeField] private float heatPerShot = 8f;
    [SerializeField] private float coolRate = 25f; // heat lost per second when not firing
    [SerializeField] private float overheatCooldown = 1.5f; // forced pause once maxed out

    [Header("References")]
    [SerializeField] private DayNightManager dayNightManager;

    private bool isNightPhase;

    private float currentHeat;
    private bool isOverheated;
    private float fireCooldownTimer;
    private float overheatTimer;
    private Turret turret;

    // UI/other systems can subscribe here instead of polling every frame.
    public event Action<float, float> OnHeatChanged; // (current, max)
    public event Action OnOverheated;
    public event Action OnCooldownComplete;

    public bool IsOverheated => isOverheated;

    private void Awake()
    {
        turret = GetComponent<Turret>();
    }

    private void OnEnable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnNightStarted += HandleNightStarted;
            dayNightManager.OnDayStarted += HandleDayStarted;
        }
    }

    private void OnDisable()
    {
        if (dayNightManager != null)
        {
            dayNightManager.OnNightStarted -= HandleNightStarted;
            dayNightManager.OnDayStarted -= HandleDayStarted;
        }
    }

    private void HandleNightStarted(int night) => isNightPhase = true;
    private void HandleDayStarted(int day) => isNightPhase = false;

    /// <summary>Called by UpgradeSystem when the player buys a fire rate upgrade.</summary>
    public void IncreaseFireRate(float amount)
    {
        fireRate += amount;
    }

    private void Update()
    {
        HandleOverheatState();
        HandleCooling();
        HandleFiringInput();
    }

    private void HandleFiringInput()
    {
        fireCooldownTimer -= Time.deltaTime;

        if (!isNightPhase) return;
        if (isOverheated) return;
        if (!Input.GetMouseButton(0)) return; // left click held to fire
        if (fireCooldownTimer > 0f) return;

        Fire();
        fireCooldownTimer = 1f / fireRate;
    }

    private void Fire()
    {
        if (projectilePrefab != null && firePoint != null)
        {
            var proj = Instantiate(projectilePrefab, firePoint.position, firePoint.rotation);
            proj.GetComponent<Projectile>()?.SetDirection(turret.AimDirection);
        }

        AddHeat(heatPerShot);
    }

    private void AddHeat(float amount)
    {
        currentHeat = Mathf.Min(maxHeat, currentHeat + amount);
        OnHeatChanged?.Invoke(currentHeat, maxHeat);

        if (currentHeat >= maxHeat)
        {
            TriggerOverheat();
        }
    }

    private void TriggerOverheat()
    {
        isOverheated = true;
        overheatTimer = overheatCooldown;
        OnOverheated?.Invoke();
    }

    private void HandleOverheatState()
    {
        if (!isOverheated) return;

        overheatTimer -= Time.deltaTime;
        if (overheatTimer <= 0f)
        {
            isOverheated = false;
            OnCooldownComplete?.Invoke();
        }
    }

    private void HandleCooling()
    {
        // Heat still drains during the forced overheat pause, not just between shots.
        if (currentHeat <= 0f) return;

        currentHeat = Mathf.Max(0f, currentHeat - coolRate * Time.deltaTime);
        OnHeatChanged?.Invoke(currentHeat, maxHeat);
    }
}