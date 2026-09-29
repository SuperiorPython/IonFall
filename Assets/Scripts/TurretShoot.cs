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

    [Header("Heat")]
    [SerializeField] private float maxHeat = 100f;
    [SerializeField] private float heatPerShot = 6f;
    [SerializeField] private float coolRate = 30f; // heat lost per second when not firing
    [SerializeField] private float overheatCooldown = 1.5f; // forced pause once maxed out

    [Header("References")]
    [SerializeField] private DayNightManager dayNightManager;

    private bool isNightPhase;
    private float currentHeat;
    private bool isOverheated;
    private float fireCooldownTimer;
    private float overheatTimer;
    private Turret turret;

    // --- Upgrade-driven state ---
    private float damageMultiplier = 1f;
    private int pierceCount = 0;
    private bool twinBarrelEnabled = false;
    private bool overheatVentEnabled = false; // when true, overheat slows firing instead of blocking it

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
        if (isOverheated && !overheatVentEnabled) return; // fully blocked, unless Overheat Vent is owned
        if (!Input.GetMouseButton(0)) return; // left click held to fire
        if (fireCooldownTimer > 0f) return;

        Fire();

        // Overheat Vent: still allow firing while overheated, but at half rate,
        // instead of the normal hard lockout.
        float effectiveFireRate = (isOverheated && overheatVentEnabled) ? fireRate * 0.5f : fireRate;
        fireCooldownTimer = 1f / effectiveFireRate;
    }

    private void Fire()
    {
        FireOneProjectile(0f);
        if (twinBarrelEnabled)
        {
            FireOneProjectile(8f); // slight spread for the second barrel
        }

        AddHeat(heatPerShot);
    }

    private void FireOneProjectile(float angleOffsetDegrees)
    {
        if (projectilePrefab == null || firePoint == null) return;

        Vector2 aimDir = turret.AimDirection;
        if (Mathf.Abs(angleOffsetDegrees) > 0.01f)
        {
            aimDir = Quaternion.Euler(0f, 0f, angleOffsetDegrees) * aimDir;
        }

        var proj = Instantiate(projectilePrefab, firePoint.position, firePoint.rotation);
        proj.GetComponent<Projectile>()?.Init(aimDir, damageMultiplier, pierceCount);
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
        if (currentHeat <= 0f) return;

        currentHeat = Mathf.Max(0f, currentHeat - coolRate * Time.deltaTime);
        OnHeatChanged?.Invoke(currentHeat, maxHeat);
    }

    // --- Upgrade hooks, called by UpgradeSystem ---

    public void IncreaseFireRate(float percent) => fireRate *= (1f + percent);
    public void IncreaseDamage(float percent) => damageMultiplier *= (1f + percent);
    public void IncreaseCoolRate(float percent) => coolRate *= (1f + percent);
    public void IncreaseMaxHeat(float percent) => maxHeat *= (1f + percent);
    public void AddPierce(int amount) => pierceCount += amount;
    public void EnableTwinBarrel() => twinBarrelEnabled = true;
    public void EnableOverheatVent() => overheatVentEnabled = true;
}
