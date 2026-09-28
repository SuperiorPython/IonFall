using UnityEngine;

/// <summary>
/// Spawns enemy prefabs at random points outside the visible play area.
/// Spawning is gated by an external "is it night" check — this script doesn't
/// own day/night state itself, it just asks (see StartSpawning/StopSpawning),
/// so DayNightManager can control it without this script needing to know
/// anything about day/night logic.
/// </summary>
public class EnemySpawner : MonoBehaviour
{
    [Header("Spawning")]
    [SerializeField] private GameObject enemyPrefab;
    [SerializeField] private float spawnInterval = 2f;
    [SerializeField] private float spawnRadius = 12f; // distance from dome to spawn at

    [Header("Scaling (temporary hardcoded curve — tune during playtesting)")]
    [SerializeField] private float intervalReductionPerNight = 0.15f;
    [SerializeField] private float minSpawnInterval = 0.4f;

    [Header("References")]
    [SerializeField] private GameBounds gameBounds; // optional — leave empty to disable the ground clamp
    [SerializeField] private DayNightManager dayNightManager; // optional — used as a race-condition safety net

    private bool isSpawning;
    private float spawnTimer;
    private int currentNight = 1;
    private Transform domeTransform;

    private void Start()
    {
        var domeObj = GameObject.FindGameObjectWithTag("Dome");
        if (domeObj != null)
        {
            domeTransform = domeObj.transform;
        }
        else
        {
            Debug.LogWarning("EnemySpawner could not find an object tagged 'Dome'.");
        }
    }

    private void Update()
    {
        if (!isSpawning) return;

        spawnTimer -= Time.deltaTime;
        if (spawnTimer <= 0f)
        {
            // Double-check phase directly (not just the isSpawning flag) — Update()
            // execution order between scripts isn't guaranteed, so this closes a
            // race where StopSpawning() lands one frame too late.
            if (dayNightManager != null && dayNightManager.CurrentPhase != DayNightManager.Phase.Night)
            {
                isSpawning = false;
                return;
            }

            SpawnEnemy();
            spawnTimer = CurrentInterval();
        }
    }

    /// <summary>Called by DayNightManager when night begins.</summary>
    public void StartSpawning(int nightNumber)
    {
        currentNight = nightNumber;
        isSpawning = true;
        spawnTimer = 0f; // spawn one immediately rather than waiting a full interval
    }

    /// <summary>Called by DayNightManager when night ends.</summary>
    public void StopSpawning()
    {
        isSpawning = false;
    }

    private float CurrentInterval()
    {
        float reduced = spawnInterval - (intervalReductionPerNight * (currentNight - 1));
        return Mathf.Max(minSpawnInterval, reduced);
    }

    private void SpawnEnemy()
    {
        if (enemyPrefab == null || domeTransform == null) return;

        Vector2 spawnPos = (Vector2)domeTransform.position + Random.insideUnitCircle.normalized * spawnRadius;

        // If this landed below ground level, reflect it back above the line
        // rather than rejecting/resampling — keeps things simple and always succeeds.
        if (gameBounds != null && spawnPos.y < gameBounds.GroundY)
        {
            spawnPos.y = gameBounds.GroundY + (gameBounds.GroundY - spawnPos.y);
        }

        Instantiate(enemyPrefab, spawnPos, Quaternion.identity);
    }
}
