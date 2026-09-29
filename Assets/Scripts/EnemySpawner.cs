using System.Collections.Generic;
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
    [SerializeField] private List<GameObject> enemyPrefabs = new List<GameObject>(); // Flying / Tank / Runner variants
    [SerializeField] private float spawnInterval = 2f;

    [Header("Scaling (temporary hardcoded curve — tune during playtesting)")]
    [SerializeField] private float intervalReductionPerNight = 0.05f;
    [SerializeField] private float minSpawnInterval = 0.4f;

    [Header("References")]
    [SerializeField] private GameBounds gameBounds; // optional — leave empty to disable the ground clamp
    [SerializeField] private PlayAreaBounds playAreaBounds; // spawns happen at this rectangle's border
    [SerializeField] private DayNightManager dayNightManager; // optional — used as a race-condition safety net
    [SerializeField] private DifficultyCurve difficultyCurve; // optional — leave empty to spawn enemies at base stats

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
        if (enemyPrefabs.Count == 0 || domeTransform == null || playAreaBounds == null) return;

        GameObject chosenPrefab = enemyPrefabs[Random.Range(0, enemyPrefabs.Count)];
        var typeMarker = chosenPrefab.GetComponent<EnemyTypeMarker>();
        bool isGroundType = typeMarker != null && typeMarker.movementType == EnemyMovementType.Ground;

        Vector2 spawnPos = isGroundType ? GroundBorderSpawnPoint() : AnyBorderSpawnPoint();

        var enemy = Instantiate(chosenPrefab, spawnPos, Quaternion.identity);

        if (difficultyCurve != null)
        {
            float healthMult = difficultyCurve.GetHealthMultiplier(currentNight);
            float damageMult = difficultyCurve.GetDamageMultiplier(currentNight);
            float speedMult = difficultyCurve.GetSpeedMultiplier(currentNight);

            enemy.GetComponent<EnemyHealth>()?.ScaleHealth(healthMult);
            enemy.GetComponent<EnemyAI>()?.ScaleDamage(damageMult);
            enemy.GetComponent<EnemyAI>()?.ScaleSpeed(speedMult);
        }
    }

    /// <summary>
    /// Ground-type enemies (Tank, Runner) only make sense entering from the
    /// left or right edge of the play area, walking in at ground height —
    /// spawning one at the top/bottom border wouldn't read as "walking in".
    /// </summary>
    private Vector2 GroundBorderSpawnPoint()
    {
        float groundY = gameBounds != null ? gameBounds.GroundY : playAreaBounds.MinY;
        float x = Random.value < 0.5f ? playAreaBounds.MinX : playAreaBounds.MaxX;
        return new Vector2(x, groundY);
    }

    /// <summary>
    /// Flying enemies can enter from any of the 4 edges of the play area border.
    /// Still respects the ground-level floor as a safety net, in case the
    /// bottom edge of the play area happens to sit below the ground line.
    /// </summary>
    private Vector2 AnyBorderSpawnPoint()
    {
        Vector2 point;
        int side = Random.Range(0, 4);
        switch (side)
        {
            case 0: // top
                point = new Vector2(Random.Range(playAreaBounds.MinX, playAreaBounds.MaxX), playAreaBounds.MaxY);
                break;
            case 1: // bottom
                point = new Vector2(Random.Range(playAreaBounds.MinX, playAreaBounds.MaxX), playAreaBounds.MinY);
                break;
            case 2: // left
                point = new Vector2(playAreaBounds.MinX, Random.Range(playAreaBounds.MinY, playAreaBounds.MaxY));
                break;
            default: // right
                point = new Vector2(playAreaBounds.MaxX, Random.Range(playAreaBounds.MinY, playAreaBounds.MaxY));
                break;
        }

        // Safety net — if this landed below ground level, reflect it back above the line.
        if (gameBounds != null && point.y < gameBounds.GroundY)
        {
            point.y = gameBounds.GroundY + (gameBounds.GroundY - point.y);
        }

        return point;
    }
}
